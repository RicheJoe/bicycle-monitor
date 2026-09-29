import { reactive } from "vue"

const RIDE_KEY = "bike-active-ride"
const ORDERS_KEY = "bike-orders"

export interface Ride {
  id: string
  bikeCode: string
  startedAt: number
}

export interface OrderRecord {
  id: string
  bikeCode: string
  startedAt: number
  endedAt: number
  fee: number
  parkingName: string
}

export interface Fix {
  latitude: number
  longitude: number
  accuracy: number
}

/** gps 使用高德高精度定位。其余三项只用于演示还车失败。 */
export type LocateMode = "gps" | "inside" | "outside" | "poor"

export const session = reactive({
  ride: null as Ride | null,
  orders: [] as OrderRecord[],
  gps: null as Fix | null,
  gpsAt: 0,
  locating: false,
  locateError: "",
})

export function hydrateRide() {
  const raw = uni.getStorageSync(RIDE_KEY) as string | Ride | ""
  if (raw) session.ride = typeof raw === "string" ? (JSON.parse(raw) as Ride) : raw
  hydrateOrders()
}

function seedOrders(): OrderRecord[] {
  const hour = 60 * 60 * 1000
  const ended = Date.now() - 26 * hour
  return [
    {
      id: "R2026092601",
      bikeCode: "BK2P9L",
      startedAt: ended - 18 * 60 * 1000,
      endedAt: ended,
      fee: 2,
      parkingName: "东北还车点",
    },
    {
      id: "R2026092502",
      bikeCode: "BK7Q1C",
      startedAt: ended - 30 * hour,
      endedAt: ended - 30 * hour + 12 * 60 * 1000,
      fee: 1.5,
      parkingName: "脚下还车点",
    },
  ]
}

export function hydrateOrders() {
  const raw = uni.getStorageSync(ORDERS_KEY) as string | OrderRecord[] | ""
  if (!raw) {
    session.orders = seedOrders()
    uni.setStorageSync(ORDERS_KEY, JSON.stringify(session.orders))
    return
  }
  session.orders = typeof raw === "string" ? (JSON.parse(raw) as OrderRecord[]) : raw
}

export function recordOrder(order: OrderRecord) {
  session.orders = [order, ...session.orders.filter((item) => item.id !== order.id)]
  uni.setStorageSync(ORDERS_KEY, JSON.stringify(session.orders))
}

export function startRide(bikeCode: string) {
  session.ride = {
    id: `R${Date.now()}`,
    bikeCode,
    startedAt: Date.now(),
  }
  uni.setStorageSync(RIDE_KEY, JSON.stringify(session.ride))
}

export function clearRide() {
  session.ride = null
  uni.removeStorageSync(RIDE_KEY)
}

export function applyGps(fix: Fix) {
  const prev = session.gps
  const recent = Date.now() - session.gpsAt < 90_000
  if (prev && recent && prev.accuracy <= 50 && fix.accuracy > 100) return
  session.gps = fix
  session.gpsAt = Date.now()
  session.locateError = ""
}

export function currentFix(): Fix {
  return session.gps || { latitude: 0, longitude: 0, accuracy: 9999 }
}

/** 还车页演示用的位置，锚点一般是当前还车区中心，不影响地图上的真实定位。 */
export function demoFix(mode: LocateMode, anchor: { latitude: number; longitude: number }): Fix {
  if (mode === "outside") return { latitude: anchor.latitude + 0.0045, longitude: anchor.longitude, accuracy: 12 }
  if (mode === "poor") return { latitude: anchor.latitude, longitude: anchor.longitude, accuracy: 68 }
  if (mode === "inside") return { latitude: anchor.latitude, longitude: anchor.longitude, accuracy: 12 }
  return currentFix()
}
