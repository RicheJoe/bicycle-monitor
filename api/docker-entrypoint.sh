#!/bin/sh
set -eu

node --input-type=module <<'EOF'
import { writeFileSync } from "node:fs"

function replaceHost(value, host) {
  if (!value) return value
  return value
    .replaceAll("://localhost", `://${host}`)
    .replaceAll("://127.0.0.1", `://${host}`)
    .replaceAll("@localhost", `@${host}`)
    .replaceAll("@127.0.0.1", `@${host}`)
}

const updates = {
  DATABASE_URL: replaceHost(process.env.DATABASE_URL, "postgres"),
  REDIS_URL: replaceHost(process.env.REDIS_URL, "redis"),
  RABBITMQ_URL: replaceHost(process.env.RABBITMQ_URL, "rabbitmq"),
  MQTT_URL: replaceHost(process.env.MQTT_URL, "emqx"),
  EMQX_API_URL: replaceHost(process.env.EMQX_API_URL, "emqx"),
}

if (!process.env.EMQX_WEBHOOK_URL) {
  const port = process.env.INTERNAL_PORT || "3001"
  updates.EMQX_WEBHOOK_URL = `http://api:${port}/internal/mqtt`
}

function quote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

const lines = Object.entries(updates)
  .filter(([, value]) => value)
  .map(([key, value]) => `export ${key}=${quote(value)}`)

writeFileSync("/tmp/docker-env.sh", `${lines.join("\n")}\n`)
EOF

# api/.env 指向宿主机端口。容器里改成 Compose 服务名，宿主机上的 npm run dev 仍用原文件。
. /tmp/docker-env.sh
rm -f /tmp/docker-env.sh

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

./node_modules/.bin/prisma migrate deploy
exec node dist/src/index.js
