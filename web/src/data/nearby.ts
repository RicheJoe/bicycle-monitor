import { reactive } from "vue"
import type { Bike, ParkingPoint } from "./mock"
import { bikeSpots, fixedAnchor, parkingSpots } from "./places"
import { offsetMeters } from "../utils/geo"

const origin = reactive({
  latitude: 0,
  longitude: 0,
  ready: false,
})

export function placesReady() {
  return Boolean(fixedAnchor) || origin.ready
}

export function placesKey() {
  if (fixedAnchor) return `fixed:${fixedAnchor.latitude},${fixedAnchor.longitude}`
  return origin.ready ? `${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}` : ""
}

/** 第一次拿到可用定位后固定原点，避免车辆跟着定位漂移。 */
export function lockOrigin(fix: { latitude: number; longitude: number; accuracy: number }) {
  if (fixedAnchor) {
    origin.latitude = fixedAnchor.latitude
    origin.longitude = fixedAnchor.longitude
    origin.ready = true
    return
  }
  if (origin.ready) return
  if (!fix.latitude || !fix.longitude || fix.accuracy > 300) return
  origin.latitude = fix.latitude
  origin.longitude = fix.longitude
  origin.ready = true
}

function resolvePoint(spot: { east: number; north: number; latitude?: number; longitude?: number }) {
  if (typeof spot.latitude === "number" && typeof spot.longitude === "number") {
    return { latitude: spot.latitude, longitude: spot.longitude }
  }
  const anchor = fixedAnchor || (origin.ready ? origin : null)
  if (!anchor) return null
  return offsetMeters(anchor, spot.east, spot.north)
}

export function listBikes(): Bike[] {
  return bikeSpots.flatMap((spot) => {
    const point = resolvePoint(spot)
    if (!point) return []
    return [{ code: spot.code, battery: spot.battery, ...point }]
  })
}

export function listParking(): ParkingPoint[] {
  return parkingSpots.flatMap((spot) => {
    const point = resolvePoint(spot)
    if (!point) return []
    return [
      {
        code: spot.code,
        name: spot.name,
        radius: spot.radius,
        enabled: spot.enabled,
        ...point,
      },
    ]
  })
}

export function findBike(code: string) {
  return listBikes().find((item) => item.code === code)
}

export function findParking(code: string) {
  return listParking().find((item) => item.code === code)
}
