import mqtt from "mqtt"
import { config } from "../config.js"
import { prisma } from "../infra/prisma.js"

const client = mqtt.connect(config.mqttUrl, {
  username: config.simulatorMqttUsername,
  password: config.simulatorMqttPassword,
  reconnectPeriod: 2000,
})

client.on("connect", () => {
  client.subscribe("bike/+/command/#", { qos: 1 })
  console.log("lock simulator connected")
})

client.on("message", (topic, payload) => {
  void reply(topic, payload).catch((error: unknown) => console.error(error))
})

async function reply(topic: string, payload: Buffer) {
  const parts = topic.split("/")
  const bikeId = parts[1]
  const action = parts[3]
  if (!bikeId || (action !== "unlock" && action !== "lock")) return
  const body = JSON.parse(payload.toString()) as { commandId?: string }
  const bike = await prisma.bike.findUnique({ where: { id: bikeId } })
  client.publish(
    `bike/${bikeId}/event/lock`,
    JSON.stringify({
      commandId: body.commandId,
      lock: action === "unlock" ? "unlocked" : "locked",
      latitude: bike?.latitude == null ? undefined : Number(bike.latitude),
      longitude: bike?.longitude == null ? undefined : Number(bike.longitude),
      coord: "gcj02",
      accuracy: 8,
      battery: bike?.battery ?? undefined,
      ts: Date.now(),
    }),
    { qos: 1 },
  )
}

setInterval(() => {
  void beat().catch((error: unknown) => console.error(error))
}, 10_000)

async function beat() {
  if (!client.connected) return
  const bikes = await prisma.bike.findMany()
  for (const bike of bikes) {
    if (bike.latitude == null || bike.longitude == null) continue
    const fix = {
      latitude: Number(bike.latitude),
      longitude: Number(bike.longitude),
      coord: "gcj02",
      accuracy: 8,
      ts: Date.now(),
    }
    client.publish(`bike/${bike.id}/event/location`, JSON.stringify(fix), { qos: 0 })
    client.publish(
      `bike/${bike.id}/event/heartbeat`,
      JSON.stringify({ battery: bike.battery ?? 0, ts: Date.now() }),
      { qos: 0 },
    )
  }
}
