import { reactive } from "vue"
import type { Bike, ParkingPoint } from "./mock"
import { fetchNearbyBikes, fetchNearbyParking } from "../utils/api"

export const catalog = reactive({
  bikes: [] as Bike[],
  parking: [] as ParkingPoint[],
  ready: false,
  error: "",
})

export function nearbyError() {
  return catalog.error
}

export function placesReady() {
  return catalog.ready
}

export function placesKey() {
  if (!catalog.ready) return ""
  const bikes = catalog.bikes.map((bike) => bike.code).join(",")
  const parks = catalog.parking.map((spot) => `${spot.code}:${spot.latitude.toFixed(5)}`).join(",")
  return `${bikes}|${parks}`
}

export function listBikes(): Bike[] {
  return catalog.bikes
}

export function listParking(): ParkingPoint[] {
  return catalog.parking
}

export function findBike(code: string) {
  return listBikes().find((item) => item.code === code)
}

export function findParking(code: string) {
  return listParking().find((item) => item.code === code)
}

let loading: Promise<void> | null = null

export function refreshNearby(fix: { latitude: number; longitude: number }) {
  if (!fix.latitude || !fix.longitude) return Promise.resolve()
  loading = (async () => {
    try {
      const [bikes, parking] = await Promise.all([
        fetchNearbyBikes(fix.latitude, fix.longitude),
        fetchNearbyParking(fix.latitude, fix.longitude),
      ])
      catalog.bikes = bikes.bikes
      catalog.parking = parking.points
      catalog.error = ""
      catalog.ready = true
    } catch (error) {
      catalog.error = error instanceof Error ? error.message : "附近车辆加载失败"
      catalog.ready = true
    }
  })()
  return loading
}
