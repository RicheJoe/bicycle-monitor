const TOKEN_KEY = "bike-token"

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

function apiBase() {
  // #ifdef H5
  return "/bike-api"
  // #endif
  // #ifndef H5
  return import.meta.env.VITE_API_BASE || "http://127.0.0.1:3000"
  // #endif
}

export function authToken() {
  return String(uni.getStorageSync(TOKEN_KEY) || "")
}

export function saveToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function request<T>(method: "GET" | "POST", path: string, data?: unknown, auth = true): Promise<T> {
  return new Promise((resolve, reject) => {
    const header: Record<string, string> = { "content-type": "application/json" }
    const token = authToken()
    if (auth && token) header.Authorization = `Bearer ${token}`
    uni.request({
      url: `${apiBase()}${path}`,
      method,
      data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
          return
        }
        const body = res.data as { code?: string; message?: string } | null
        reject(new ApiError(body?.code || "HTTP", body?.message || "请求失败"))
      },
      fail() {
        reject(new ApiError("NETWORK", "网络异常，请稍后重试"))
      },
    })
  })
}

export interface RideDto {
  id: string
  bikeCode: string
  startedAt: number | null
}

export interface OrderDto {
  id: string
  bikeCode: string
  startedAt: number
  endedAt: number
  fee: number
  parkingName: string
}

export function loginDev() {
  return request<{ token: string; user: { id: string; nickname: string } }>("POST", "/auth/dev", {}, false)
}

export function loginWechat(code: string) {
  return request<{ token: string; user: { id: string; nickname: string } }>("POST", "/auth/wechat", { code }, false)
}

export function fetchMe() {
  return request<{ id: string; nickname: string; phone: string | null }>("GET", "/me")
}

export function fetchCurrentRide() {
  return request<{ ride: RideDto | null }>("GET", "/rides/current")
}

export function fetchOrders() {
  return request<{ orders: OrderDto[] }>("GET", "/rides")
}

export function createRide(code: string) {
  return request<{ ride: RideDto }>("POST", "/rides", { code })
}

export function returnRide(id: string, body: {
  code: string
  latitude: number
  longitude: number
  accuracy: number
  locatedAt: number
}) {
  return request<{ spotName: string; duration: string; fee: number; endedAt: number }>(
    "POST",
    `/rides/${id}/return`,
    body,
  )
}

export function reportPoint(id: string, body: {
  latitude: number
  longitude: number
  accuracy: number
  locatedAt: number
}) {
  return request<unknown>("POST", `/rides/${id}/points`, body)
}

export function fetchNearbyBikes(latitude: number, longitude: number) {
  return request<{ bikes: { code: string; battery: number; latitude: number; longitude: number }[] }>(
    "GET",
    `/bikes/nearby?latitude=${latitude}&longitude=${longitude}`,
  )
}

export function fetchNearbyParking(latitude: number, longitude: number) {
  return request<{
    points: { code: string; name: string; latitude: number; longitude: number; radius: number; enabled: boolean }[]
  }>("GET", `/parking-points/nearby?latitude=${latitude}&longitude=${longitude}`)
}
