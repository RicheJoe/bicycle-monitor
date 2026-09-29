const PI = Math.PI
const AXIS = 6378245.0
const EE = 0.00669342162296594323

function outOfChina(longitude: number, latitude: number) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271
}

function transformLatitude(longitude: number, latitude: number) {
  let value =
    -100 +
    2 * longitude +
    3 * latitude +
    0.2 * latitude * latitude +
    0.1 * longitude * latitude +
    0.2 * Math.sqrt(Math.abs(longitude))
  value += ((20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) * 2) / 3
  value += ((20 * Math.sin(latitude * PI) + 40 * Math.sin((latitude / 3) * PI)) * 2) / 3
  value += ((160 * Math.sin((latitude / 12) * PI) + 320 * Math.sin((latitude * PI) / 30)) * 2) / 3
  return value
}

function transformLongitude(longitude: number, latitude: number) {
  let value =
    300 +
    longitude +
    2 * latitude +
    0.1 * longitude * longitude +
    0.1 * longitude * latitude +
    0.1 * Math.sqrt(Math.abs(longitude))
  value += ((20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) * 2) / 3
  value += ((20 * Math.sin(longitude * PI) + 40 * Math.sin((longitude / 3) * PI)) * 2) / 3
  value += ((150 * Math.sin((longitude / 12) * PI) + 300 * Math.sin((longitude / 30) * PI)) * 2) / 3
  return value
}

/** 与 web/src/utils/gcj.ts 相同。中国境外坐标不转换。 */
export function wgs84ToGcj02(longitude: number, latitude: number) {
  if (outOfChina(longitude, latitude)) return { longitude, latitude }
  const latitudeDelta = transformLatitude(longitude - 105, latitude - 35)
  const longitudeDelta = transformLongitude(longitude - 105, latitude - 35)
  const radian = (latitude / 180) * PI
  let magic = Math.sin(radian)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  const dLat = (latitudeDelta * 180) / (((AXIS * (1 - EE)) / (magic * sqrtMagic)) * PI)
  const dLng = (longitudeDelta * 180) / ((AXIS / sqrtMagic) * Math.cos(radian) * PI)
  return { longitude: longitude + dLng, latitude: latitude + dLat }
}
