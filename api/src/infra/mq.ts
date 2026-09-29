import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from "amqplib"
import { config } from "../config.js"

export const exchange = "bike.events"
export const deadExchange = "bike.events.dlx"

let connection: ChannelModel | null = null
let channel: Channel | null = null

export function mqChannel() {
  if (!channel) throw new Error("RabbitMQ is not connected")
  return channel
}

export async function connectMq() {
  connection = await amqp.connect(config.rabbitUrl)
  channel = await connection.createChannel()
  await channel.prefetch(10)
  await channel.assertExchange(exchange, "topic", { durable: true })
  await channel.assertExchange(deadExchange, "topic", { durable: true })

  await assertWorkQueue("bike.notify", ["bike.ride.started", "bike.ride.finished"])
  await assertWorkQueue("bike.track", ["bike.ride.finished"])
}

async function assertWorkQueue(name: string, keys: string[]) {
  const current = mqChannel()
  await current.assertQueue(name, {
    durable: true,
    arguments: { "x-dead-letter-exchange": deadExchange },
  })
  await current.assertQueue(`${name}.retry`, {
    durable: true,
    arguments: {
      "x-message-ttl": 5000,
      "x-dead-letter-exchange": exchange,
    },
  })
  await current.assertQueue(`${name}.dlq`, { durable: true })
  for (const key of keys) {
    await current.bindQueue(name, exchange, key)
    await current.bindQueue(`${name}.retry`, deadExchange, key)
  }
  await current.bindQueue(`${name}.dlq`, deadExchange, `${name}.dlq`)
}

export function publishEvent(routingKey: string, payload: unknown) {
  mqChannel().publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true })
}

export function deathCount(message: ConsumeMessage) {
  const header = message.properties.headers?.["x-death"]
  if (!Array.isArray(header)) return 0
  return header.reduce((max, item) => Math.max(max, Number(item.count) || 0), 0)
}

export async function closeMq() {
  await channel?.close()
  await connection?.close()
  channel = null
  connection = null
}
