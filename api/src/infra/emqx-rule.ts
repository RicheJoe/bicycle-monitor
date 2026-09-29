import { config } from "../config.js"

/** 尽力把上行规则接到内网回调。失败时由调用方改为进程内订阅。 */
export async function setupEmqxRule() {
  if (!config.emqxApiUrl || !config.emqxDashboardUser || !config.emqxDashboardPassword) return false
  const login = await fetch(`${config.emqxApiUrl}/api/v5/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: config.emqxDashboardUser, password: config.emqxDashboardPassword }),
  })
  if (!login.ok) return false
  const token = (await login.json()) as { token?: string }
  if (!token.token) return false
  const headers = { authorization: `Bearer ${token.token}`, "content-type": "application/json" }
  const existing = await fetch(`${config.emqxApiUrl}/api/v5/rules/bike_uplink`, { headers })
  if (existing.ok) return true
  const connector = "bike_api"
  await fetch(`${config.emqxApiUrl}/api/v5/connectors`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "http",
      name: connector,
      url: `http://host.docker.internal:${config.internalPort}/internal/mqtt`,
      headers: { "X-Webhook-Secret": config.webhookSecret },
      connect_timeout: "5s",
      pool_size: 4,
      enable: true,
    }),
  })
  await fetch(`${config.emqxApiUrl}/api/v5/actions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "http",
      name: "bike_uplink",
      connector,
      parameters: { method: "post", body: "${.}" },
      enable: true,
    }),
  })
  const rule = await fetch(`${config.emqxApiUrl}/api/v5/rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: "bike_uplink",
      sql: `SELECT nth(2, split(topic, '/')) as bikeId, nth(4, split(topic, '/')) as event, payload.commandId as commandId, payload.lock as lock, payload.latitude as latitude, payload.longitude as longitude, payload.coord as coord, payload.accuracy as accuracy, payload.battery as battery, payload.ts as ts FROM "bike/+/event/#"`,
      actions: ["http:bike_uplink"],
      enable: true,
    }),
  })
  return rule.ok || rule.status === 409
}
