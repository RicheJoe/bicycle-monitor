import { reactive } from "vue"
import { fetchCurrentRide, fetchMe, fetchOrders, loginDev, loginWechat, saveToken, type RideDto } from "../utils/api"

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
  nickname: "骑行用户",
  phone: "",
  gps: null as Fix | null,
  gpsAt: 0,
  locating: false,
  locateError: "",
  accountError: "",
})

function adopt(ride: RideDto | null) {
  if (!ride) {
    session.ride = null
    return
  }
  session.ride = {
    id: ride.id,
    bikeCode: ride.bikeCode,
    startedAt: ride.startedAt ?? Date.now(),
  }
}

async function login() {
  // #ifdef H5
  const dev = await loginDev()
  saveToken(dev.token)
  return
  // #endif
  // #ifndef H5
  try {
    const loginResult = await uni.login({ provider: "weixin" })
    const wechat = await loginWechat(loginResult.code)
    saveToken(wechat.token)
  } catch {
    const dev = await loginDev()
    saveToken(dev.token)
  }
  // #endif
}

export async function refreshAccount() {
  const [me, current, orders] = await Promise.all([fetchMe(), fetchCurrentRide(), fetchOrders()])
  session.nickname = me.nickname
  session.phone = me.phone || ""
  adopt(current.ride)
  session.orders = orders.orders
  session.accountError = ""
}

export async function ensureSession() {
  try {
    await login()
    await refreshAccount()
  } catch (error) {
    session.accountError = error instanceof Error ? error.message : "登录失败"
  }
}

export function setRide(ride: Ride) {
  session.ride = ride
}

export function clearRide() {
  session.ride = null
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
