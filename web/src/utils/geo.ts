export interface LatLng {
  latitude: number
  longitude: number
}

export function distanceMeters(a: LatLng, b: LatLng) {
  const earth = 6371000
  const toRad = (degree: number) => (degree * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 从原点向东、北各偏移若干米，得到 GCJ-02 坐标。 */
export function offsetMeters(origin: LatLng, east: number, north: number): LatLng {
  const latitude = origin.latitude + north / 110540
  const metersPerLng = 111320 * Math.cos((origin.latitude * Math.PI) / 180)
  const longitude = origin.longitude + east / metersPerLng
  return { latitude, longitude }
}
