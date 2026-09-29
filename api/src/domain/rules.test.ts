import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { estimateFee, formatDuration } from "./fee.js"
import { distanceMeters } from "./geo.js"
import { wgs84ToGcj02 } from "./gcj.js"
import { parseCode } from "./qr.js"
import { checkReturn } from "./return-check.js"
import { buildTrack, shouldKeepPoint, type TrackSample } from "./track.js"

const limits = {
  accuracyLimitM: 30,
  zoneBufferM: 15,
  bikeUserDistanceM: 80,
  bikeLocationMaxAgeMs: 120_000,
  now: 1_000_000,
}

const spot = { latitude: 31.23, longitude: 121.47, radius: 100, enabled: true }

describe("计费", () => {
  const start = 0
  it("1 分钟、15 分钟按起步价", () => {
    assert.equal(estimateFee(start, 60_000), 1.5)
    assert.equal(estimateFee(start, 15 * 60_000), 1.5)
  })
  it("16 分钟和 30 分钟加一档", () => {
    assert.equal(estimateFee(start, 16 * 60_000), 2)
    assert.equal(estimateFee(start, 30 * 60_000), 2)
  })
  it("时长格式", () => {
    assert.equal(formatDuration(0, 192_000), "03:12")
  })
})

describe("球面距离", () => {
  it("同一点距离为 0", () => {
    assert.equal(distanceMeters(spot, spot), 0)
  })
  it("向北约 100 米", () => {
    const north = { latitude: spot.latitude + 100 / 110540, longitude: spot.longitude }
    const distance = distanceMeters(spot, north)
    assert.ok(distance > 95 && distance < 105)
  })
})

describe("二维码", () => {
  it("解析链接和纯编号", () => {
    assert.equal(parseCode("https://bike.example/b/bk8k2m", "b"), "BK8K2M")
    assert.equal(parseCode("pk3n7q", "p"), "PK3N7Q")
  })
  it("其它 http 链接为空", () => {
    assert.equal(parseCode("https://bike.example/x/BK8K2M", "b"), "")
  })
})

describe("还车判定", () => {
  const user = { latitude: spot.latitude, longitude: spot.longitude }
  it("停用停车点和区域外", () => {
    assert.equal(checkReturn({ accuracy: 12, user, spot: { ...spot, enabled: false }, bike: null, limits })?.code, "INVALID_QR")
    const outside = { latitude: spot.latitude + 0.0045, longitude: spot.longitude }
    assert.equal(checkReturn({ accuracy: 12, user: outside, spot, bike: null, limits })?.code, "OUT_OF_ZONE")
  })
  it("精度 68 米拒绝", () => {
    assert.equal(checkReturn({ accuracy: 68, user, spot, bike: null, limits })?.code, "POOR_ACCURACY")
  })
  it("没有新鲜车载定位时跳过车辆位置", () => {
    assert.equal(checkReturn({ accuracy: 12, user, spot, bike: null, limits }), null)
  })
  it("车在区域外且离用户过远", () => {
    const bike = { latitude: spot.latitude + 0.01, longitude: spot.longitude, locationAt: limits.now }
    assert.equal(checkReturn({ accuracy: 12, user, spot, bike, limits })?.code, "BIKE_OUT_OF_ZONE")
  })
})

describe("轨迹", () => {
  const base: TrackSample = { latitude: 31.23, longitude: 121.47, recordedAt: 0, source: "user", accuracy: 10 }
  const trackLimits = { accuracyLimitM: 80, minIntervalMs: 15_000, minDistanceM: 15 }
  it("同来源近点丢掉，间隔或距离够了就保留", () => {
    const near = { ...base, recordedAt: 5_000, latitude: base.latitude + 0.00001 }
    assert.equal(shouldKeepPoint(near, base, trackLimits), false)
    const later = { ...base, recordedAt: 20_000 }
    assert.equal(shouldKeepPoint(later, base, trackLimits), true)
  })
  it("车锁点不少于 2 个时只用车锁点", () => {
    const points: TrackSample[] = [
      { ...base, source: "user", recordedAt: 1 },
      { ...base, source: "device", recordedAt: 2, latitude: 31.231 },
      { ...base, source: "device", recordedAt: 3, latitude: 31.232 },
    ]
    const track = buildTrack(points)
    assert.equal(track.points.length, 2)
    assert.ok(track.points.every((point) => point.source === "device"))
    assert.ok(track.distanceMeters > 0)
  })
  it("车锁点不足时用手机点", () => {
    const track = buildTrack([
      base,
      { ...base, recordedAt: 20_000, latitude: 31.231 },
    ])
    assert.equal(track.points.length, 2)
    assert.equal(track.points[0]?.source, "user")
  })
})

describe("坐标转换", () => {
  it("中国境外不转换", () => {
    assert.deepEqual(wgs84ToGcj02(0, 0), { longitude: 0, latitude: 0 })
  })
})
