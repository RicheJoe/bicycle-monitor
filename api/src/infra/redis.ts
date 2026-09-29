import Redis from "ioredis"
import { config } from "../config.js"

const options = { maxRetriesPerRequest: null, lazyConnect: true } as const

export const redis = new Redis(config.redisUrl, options)
const blocking = new Redis(config.redisUrl, options)

async function connect(client: Redis) {
  if (client.status === "wait") await client.connect()
}

export async function connectRedis() {
  await Promise.all([connect(redis), connect(blocking)])
  await redis.ping()
}

export async function pushCommandAck(commandId: string) {
  const key = `cmd:${commandId}`
  await redis.multi().rpush(key, "1").expire(key, 30).exec()
}

export async function waitForCommand(commandId: string, timeoutMs: number) {
  const result = await blocking.blpop(`cmd:${commandId}`, Math.max(1, Math.ceil(timeoutMs / 1000)))
  return result !== null
}

export async function acquireReturnLock(rideId: string, token: string) {
  const result = await redis.set(`ride:return:${rideId}`, token, "EX", 15, "NX")
  return result === "OK"
}

export async function releaseReturnLock(rideId: string, token: string) {
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    `ride:return:${rideId}`,
    token,
  )
}

export async function markEventDone(routingKey: string, rideId: string) {
  const result = await redis.set(`event:done:${routingKey}:${rideId}`, "1", "EX", 7 * 24 * 3600, "NX")
  return result === "OK"
}

export async function searchGeo(key: string, longitude: number, latitude: number, radius: number) {
  const members = await redis.call(
    "GEOSEARCH",
    key,
    "FROMLONLAT",
    String(longitude),
    String(latitude),
    "BYRADIUS",
    String(radius),
    "m",
    "ASC",
    "COUNT",
    "50",
  )
  return Array.isArray(members) ? members.map(String) : []
}

export function closeRedis() {
  redis.disconnect()
  blocking.disconnect()
}
