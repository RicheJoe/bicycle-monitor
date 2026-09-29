import { prisma } from "../infra/prisma.js"
import { searchGeo } from "../infra/redis.js"

export async function nearbyBikes(latitude: number, longitude: number, radius: number) {
  const ids = await searchGeo("geo:bikes", longitude, latitude, radius)
  if (ids.length === 0) return { bikes: [] }
  const rows = await prisma.bike.findMany({ where: { id: { in: ids }, status: "idle" } })
  const byId = new Map(rows.map((bike) => [bike.id, bike]))
  return {
    bikes: ids.flatMap((id) => {
      const bike = byId.get(id)
      if (!bike || bike.latitude == null || bike.longitude == null) return []
      return [
        {
          code: bike.id,
          battery: bike.battery ?? 0,
          latitude: Number(bike.latitude),
          longitude: Number(bike.longitude),
        },
      ]
    }),
  }
}

export async function nearbyParking(latitude: number, longitude: number, radius: number) {
  const ids = await searchGeo("geo:parking", longitude, latitude, radius)
  if (ids.length === 0) return { points: [] }
  const rows = await prisma.parkingPoint.findMany({ where: { id: { in: ids } } })
  const byId = new Map(rows.map((point) => [point.id, point]))
  return {
    points: ids.flatMap((id) => {
      const point = byId.get(id)
      if (!point) return []
      return [
        {
          code: point.code,
          name: point.name,
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          radius: point.radius,
          enabled: point.enabled,
        },
      ]
    }),
  }
}
