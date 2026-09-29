const START_YUAN = 1.5
const START_MINUTES = 15
const STEP_YUAN = 0.5
const STEP_MINUTES = 15

export function rideMinutes(startedAt: number, now = Date.now()) {
  return Math.max(1, Math.ceil((now - startedAt) / 60000))
}

export function estimateFee(startedAt: number, now = Date.now()) {
  const minutes = rideMinutes(startedAt, now)
  if (minutes <= START_MINUTES) return START_YUAN
  const steps = Math.ceil((minutes - START_MINUTES) / STEP_MINUTES)
  return START_YUAN + steps * STEP_YUAN
}

export function feeCents(startedAt: number, endedAt: number) {
  return Math.round(estimateFee(startedAt, endedAt) * 100)
}

export function yuanFromCents(cents: number) {
  return cents / 100
}

export function formatDuration(startedAt: number, now = Date.now()) {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, "0")
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}
