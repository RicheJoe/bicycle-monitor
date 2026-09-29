import type { Bike, ParkingPoint } from "@prisma/client"
import { prisma } from "./prisma.js"
import { redis } from "./redis.js"

function num(value: { toString(): string } | null) {
  return value == null ? null : Number(value)
}

export async function syncBike(bike: Bike) {
  const latitude = num(bike.latitude)
  const longitude = num(bike.longitude)
  const pipeline = redis.pipeline()
  pipeline.hset(`bike:state:${bike.id}`, {
    status: bike.status,
    lock: bike.lockState,
    battery: bike.battery == null ? "" : String(bike.battery),
    lat: latitude == null ? "" : String(latitude),
    lng: longitude == null ? "" : String(longitude),
    locationAt: bike.locationAt ? String(bike.locationAt.getTime()) : "",
  })
  if (latitude != null && longitude != null) pipeline.geoadd("geo:bikes", longitude, latitude, bike.id)
  else pipeline.zrem("geo:bikes", bike.id)
  await pipeline.exec()
}

export async function syncParking(point: ParkingPoint) {
  await redis.geoadd("geo:parking", Number(point.longitude), Number(point.latitude), point.id)
}

export async function rebuildGeo() {
  const [bikes, points] = await Promise.all([prisma.bike.findMany(), prisma.parkingPoint.findMany()])
  const pipeline = redis.pipeline()
  pipeline.del("geo:bikes", "geo:parking")
  for (const bike of bikes) pipeline.del(`bike:state:${bike.id}`)
  await pipeline.exec()
  for (const bike of bikes) await syncBike(bike)
  for (const point of points) await syncParking(point)
}
