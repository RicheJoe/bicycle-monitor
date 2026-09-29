import { BikeStatus, LockState, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const bikes = [
  { id: "BK8K2M", battery: 86, east: -45, north: 35 },
  { id: "BK2P9L", battery: 64, east: 80, north: 20 },
  { id: "BK7Q1C", battery: 41, east: 25, north: -70 },
]

const parkingPoints = [
  { code: "PK3N7Q", name: "脚下还车点", east: 0, north: 0, radius: 100, enabled: true },
  { code: "PK9W4D", name: "东北还车点", east: 130, north: 60, radius: 70, enabled: true },
  { code: "PK0X1Z", name: "南侧还车点", east: -20, north: -140, radius: 60, enabled: false },
]

const devNickname = "骑行用户"

function offsetMeters(origin: { latitude: number; longitude: number }, east: number, north: number) {
  const latitude = origin.latitude + north / 110540
  const metersPerLng = 111320 * Math.cos((origin.latitude * Math.PI) / 180)
  const longitude = origin.longitude + east / metersPerLng
  return {
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
  }
}

function anchor() {
  const latitude = Number(process.env.SEED_ANCHOR_LAT)
  const longitude = Number(process.env.SEED_ANCHOR_LNG)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("SEED_ANCHOR_LAT and SEED_ANCHOR_LNG are required")
  }
  return { latitude, longitude }
}

async function main() {
  const origin = anchor()

  for (const bike of bikes) {
    const point = offsetMeters(origin, bike.east, bike.north)
    const existing = await prisma.bike.findUnique({ where: { id: bike.id } })
    const riding = existing?.status === BikeStatus.riding
    await prisma.bike.upsert({
      where: { id: bike.id },
      create: {
        id: bike.id,
        bodyCode: bike.id,
        status: BikeStatus.idle,
        lockState: LockState.locked,
        battery: bike.battery,
        latitude: point.latitude,
        longitude: point.longitude,
      },
      update: riding
        ? { bodyCode: bike.id, battery: bike.battery }
        : {
            bodyCode: bike.id,
            battery: bike.battery,
            status: BikeStatus.idle,
            lockState: LockState.locked,
            latitude: point.latitude,
            longitude: point.longitude,
          },
    })
  }

  for (const spot of parkingPoints) {
    const point = offsetMeters(origin, spot.east, spot.north)
    await prisma.parkingPoint.upsert({
      where: { code: spot.code },
      create: {
        code: spot.code,
        name: spot.name,
        latitude: point.latitude,
        longitude: point.longitude,
        radius: spot.radius,
        enabled: spot.enabled,
      },
      update: {
        name: spot.name,
        latitude: point.latitude,
        longitude: point.longitude,
        radius: spot.radius,
        enabled: spot.enabled,
      },
    })
  }

  const devUser = await prisma.user.findFirst({
    where: { openid: null, nickname: devNickname },
  })
  if (!devUser) {
    await prisma.user.create({ data: { nickname: devNickname } })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
