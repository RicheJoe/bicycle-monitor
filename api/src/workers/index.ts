import type { ConsumeMessage } from "amqplib"
import { buildTrack } from "../domain/track.js"
import { prisma } from "../infra/prisma.js"
import { deadExchange, deathCount, mqChannel, publishEvent } from "../infra/mq.js"
import { markEventDone } from "../infra/redis.js"

function readJson(message: ConsumeMessage) {
  return JSON.parse(message.content.toString()) as { rideId?: string }
}

async function consume(queue: string, handle: (message: ConsumeMessage) => Promise<void>) {
  await mqChannel().consume(queue, (message) => {
    if (!message) return
    void (async () => {
      try {
        if (deathCount(message) >= 5) {
          publishDead(queue, message)
          mqChannel().ack(message)
          return
        }
        await handle(message)
        mqChannel().ack(message)
      } catch (error) {
        console.error(error)
        mqChannel().nack(message, false, false)
      }
    })()
  })
}

function publishDead(queue: string, message: ConsumeMessage) {
  mqChannel().publish(deadExchange, `${queue}.dlq`, message.content, { persistent: true, headers: message.properties.headers })
}

export async function startConsumers() {
  await consume("bike.notify", async (message) => {
    const body = readJson(message)
    const routingKey = message.fields.routingKey
    if (!body.rideId) return
    const fresh = await markEventDone(routingKey, body.rideId)
    if (!fresh) return
    console.log(JSON.stringify({ event: routingKey, rideId: body.rideId }))
  })

  await consume("bike.track", async (message) => {
    const body = readJson(message)
    if (!body.rideId) return
    const ride = await prisma.ride.findUnique({ where: { id: body.rideId } })
    if (!ride || ride.track != null) return
    const rows = await prisma.ridePoint.findMany({ where: { rideId: ride.id }, orderBy: { recordedAt: "asc" } })
    const track = buildTrack(
      rows.map((row) => ({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        recordedAt: row.recordedAt.getTime(),
        source: row.source,
      })),
    )
    await prisma.ride.update({
      where: { id: ride.id },
      data: { track: track.points, distanceMeters: track.distanceMeters },
    })
  })
}

let timer: NodeJS.Timeout | null = null

export function startOutbox() {
  timer = setInterval(() => {
    void flushOutbox().catch((error: unknown) => console.error(error))
  }, 500)
}

export function stopOutbox() {
  if (timer) clearInterval(timer)
  timer = null
}

async function flushOutbox() {
  const rows = await prisma.outbox.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: "asc" },
    take: 50,
  })
  for (const row of rows) {
    publishEvent(row.routingKey, row.payload)
    await prisma.outbox.update({ where: { id: row.id }, data: { publishedAt: new Date() } })
  }
}
