export interface Bike {
  code: string
  battery: number
  latitude: number
  longitude: number
}

export interface ParkingPoint {
  code: string
  name: string
  latitude: number
  longitude: number
  radius: number
  enabled: boolean
}

export const ZONE_BUFFER_M = 15
export const ACCURACY_LIMIT_M = 30
