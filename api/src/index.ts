import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { createServer } from "node:http"
import { config } from "./config.js"
import { createInternalApp, createPublicApp } from "./app.js"
import { closeMq, connectMq } from "./infra/mq.js"
import { closeMqtt, connectMqtt, setUplinkHandler } from "./infra/mqtt.js"
import { prisma } from "./infra/prisma.js"
import { connectRedis, closeRedis } from "./infra/redis.js"
import { rebuildGeo } from "./infra/state.js"
import { setupEmqxRule } from "./infra/emqx-rule.js"
import { handleUplink, type Uplink } from "./modules/uplink.js"
import { startConsumers, startOutbox, stopOutbox } from "./workers/index.js"

const exec = promisify(execFile)

async function seedIfNeeded() {
  if (process.env.SEED !== "1") return
  await exec("npx", ["prisma", "db", "seed"], { cwd: process.cwd() })
}

function wireUplink() {
  setUplinkHandler(async (topic, payload) => {
    const parts = topic.split("/")
    if (parts[0] !== "bike" || parts[2] !== "event") return
    const body = JSON.parse(payload.toString()) as Omit<Uplink, "bikeId" | "event">
    try {
      await handleUplink({ ...body, bikeId: parts[1] ?? "", event: parts[3] ?? "" })
    } catch (error) {
      const status = error instanceof Error && "status" in error ? (error as { status: number }).status : 0
      if (status === 404) return
      throw error
    }
  })
}

async function main() {
  await seedIfNeeded()
  await connectRedis()
  await rebuildGeo()
  await connectMq()
  await startConsumers()
  startOutbox()
  wireUplink()

  const internal = createServer(createInternalApp())
  const publicServer = createServer(createPublicApp())
  await new Promise<void>((resolve) => internal.listen(config.internalPort, resolve))
  await new Promise<void>((resolve) => publicServer.listen(config.httpPort, resolve))

  const ruled = await setupEmqxRule().catch(() => false)
  await connectMqtt(!ruled)
  console.log(`api listening on ${config.httpPort}, internal ${config.internalPort}, emqx rule ${ruled ? "on" : "off"}`)

  const shutdown = async () => {
    stopOutbox()
    publicServer.close()
    internal.close()
    closeMqtt()
    await closeMq()
    closeRedis()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on("SIGTERM", () => void shutdown())
  process.on("SIGINT", () => void shutdown())
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
