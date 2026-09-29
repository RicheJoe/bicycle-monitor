/**
 * 附近车辆和还车区。坐标相对「定位原点」，单位是米，东、北为正。
 * 第一次拿到精度够用的定位后，原点就固定，避免车辆跟着人漂移。
 *
 * 想改绝对坐标：给某一项写上 latitude、longitude（GCJ-02），该项就不再跟定位走。
 * 想整片钉死：把 fixedAnchor 设成一组 GCJ-02，所有相对偏移都从这里算。
 */
export const fixedAnchor: { latitude: number; longitude: number } | null = null

export const bikeSpots = [
  { code: "BK8K2M", battery: 86, east: -45, north: 35 },
  { code: "BK2P9L", battery: 64, east: 80, north: 20 },
  { code: "BK7Q1C", battery: 41, east: 25, north: -70 },
]

export const parkingSpots = [
  { code: "PK3N7Q", name: "脚下还车点", east: 0, north: 0, radius: 100, enabled: true },
  { code: "PK9W4D", name: "东北还车点", east: 130, north: 60, radius: 70, enabled: true },
  { code: "PK0X1Z", name: "南侧还车点", east: -20, north: -140, radius: 60, enabled: false },
]
