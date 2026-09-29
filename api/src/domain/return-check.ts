import { distanceMeters, type LatLng } from "./geo.js"
import { errors } from "../errors.js"

export interface ReturnSpot extends LatLng {
  radius: number
  enabled: boolean
}

export interface ReturnBike extends LatLng {
  locationAt: number | null
}

export interface ReturnLimits {
  accuracyLimitM: number
  zoneBufferM: number
  bikeUserDistanceM: number
  bikeLocationMaxAgeMs: number
  now: number
}

/** 还车第 2 到第 5 步。通过时返回 null。 */
export function checkReturn(input: {
  accuracy: number | null
  user: LatLng
  spot: ReturnSpot | null
  bike: ReturnBike | null
  limits: ReturnLimits
}) {
  if (!input.spot || !input.spot.enabled) return errors.invalidQr()
  if (input.accuracy == null || input.accuracy > input.limits.accuracyLimitM) return errors.poorAccuracy()
  const allowed = input.spot.radius + input.limits.zoneBufferM
  if (distanceMeters(input.user, input.spot) > allowed) return errors.outOfZone()

  const fresh =
    input.bike != null &&
    input.bike.locationAt != null &&
    input.limits.now - input.bike.locationAt <= input.limits.bikeLocationMaxAgeMs
  if (!fresh || !input.bike) return null
  const bikeInside = distanceMeters(input.bike, input.spot) <= allowed
  const bikeNearUser = distanceMeters(input.bike, input.user) <= input.limits.bikeUserDistanceM
  if (!bikeInside && !bikeNearUser) return errors.bikeOutOfZone()
  return null
}
