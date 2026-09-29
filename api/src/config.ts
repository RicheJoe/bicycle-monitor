import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

function loadEnvFile() {
  const path = resolve(process.cwd(), ".env")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function integer(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`)
  return value
}

loadEnvFile()

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  rabbitUrl: required("RABBITMQ_URL"),
  mqttUrl: required("MQTT_URL"),
  mqttUsername: process.env.MQTT_USERNAME || undefined,
  mqttPassword: process.env.MQTT_PASSWORD || undefined,
  simulatorMqttUsername: process.env.SIMULATOR_MQTT_USERNAME || undefined,
  simulatorMqttPassword: process.env.SIMULATOR_MQTT_PASSWORD || undefined,
  webhookSecret: required("EMQX_WEBHOOK_SECRET"),
  jwtSecret: required("JWT_SECRET"),
  wechatAppId: process.env.WECHAT_APPID || "",
  wechatSecret: process.env.WECHAT_SECRET || "",
  zoneBufferM: integer("ZONE_BUFFER_M", 15),
  accuracyLimitM: integer("ACCURACY_LIMIT_M", 30),
  bikeUserDistanceM: integer("BIKE_USER_DISTANCE_M", 80),
  bikeLocationMaxAgeMs: integer("BIKE_LOCATION_MAX_AGE_MS", 120_000),
  commandTimeoutMs: integer("COMMAND_TIMEOUT_MS", 8_000),
  trackMinIntervalMs: integer("TRACK_MIN_INTERVAL_MS", 15_000),
  trackMinDistanceM: integer("TRACK_MIN_DISTANCE_M", 15),
  trackAccuracyLimitM: integer("TRACK_ACCURACY_LIMIT_M", 80),
  httpPort: integer("HTTP_PORT", 3000),
  internalPort: integer("INTERNAL_PORT", 3001),
  emqxApiUrl: process.env.EMQX_API_URL || "",
  emqxWebhookUrl:
    process.env.EMQX_WEBHOOK_URL ||
    `http://host.docker.internal:${integer("INTERNAL_PORT", 3001)}/internal/mqtt`,
  emqxDashboardUser: process.env.EMQX_DASHBOARD__DEFAULT_USERNAME || "",
  emqxDashboardPassword: process.env.EMQX_DASHBOARD__DEFAULT_PASSWORD || "",
}

export const activeRideStatuses = ["unlocking", "riding", "locking"] as const
