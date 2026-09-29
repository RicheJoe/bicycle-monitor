import { distanceMeters, type LatLng } from "./geo.js"

export type PointSource = "user" | "device"

export interface TrackSample extends LatLng {
  recordedAt: number
  source: PointSource
  accuracy?: number | null
}

export interface TrackLimits {
  accuracyLimitM: number
  minIntervalMs: number
  minDistanceM: number
}

export function shouldKeepPoint(sample: TrackSample, previous: TrackSample | undefined, limits: TrackLimits) {
  if (sample.accuracy != null && sample.accuracy > limits.accuracyLimitM) return false
  if (!previous) return true
  const distance = distanceMeters(sample, previous)
  const elapsed = sample.recordedAt - previous.recordedAt
  if (distance < limits.minDistanceM && elapsed < limits.minIntervalMs) return false
  return true
}

export function buildTrack(points: TrackSample[]) {
  const ordered = [...points].sort((a, b) => a.recordedAt - b.recordedAt)
  const device = ordered.filter((point) => point.source === "device")
  const user = ordered.filter((point) => point.source === "user")
  const chosen = device.length >= 2 ? device : user
  let distance = 0
  for (let index = 1; index < chosen.length; index += 1) {
    distance += distanceMeters(chosen[index - 1], chosen[index])
  }
  return {
    distanceMeters: Math.round(distance),
    points: chosen.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt: point.recordedAt,
      source: point.source,
    })),
  }
}
