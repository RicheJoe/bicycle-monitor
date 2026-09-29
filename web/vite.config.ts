import { execSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import uni from "@dcloudio/vite-plugin-uni"

const root = path.dirname(fileURLToPath(import.meta.url))

function lanIps() {
  const ips = ["127.0.0.1"]
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === "IPv4" && !item.internal) ips.push(item.address)
    }
  }
  return ips
}

function devHttps() {
  const dir = path.join(root, ".cert")
  fs.mkdirSync(dir, { recursive: true })
  const keyPath = path.join(dir, "key.pem")
  const certPath = path.join(dir, "cert.pem")
  const san = ["DNS:localhost", ...lanIps().map((ip) => `IP:${ip}`)].join(",")
  const stampPath = path.join(dir, "san.txt")
  const current = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, "utf8") : ""
  if (current !== san || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=bicycle-dev" -addext "subjectAltName=${san}"`,
      { stdio: "ignore" }
    )
    fs.writeFileSync(stampPath, san)
  }
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  }
}

export default defineConfig({
  plugins: [uni()],
  server: {
    host: true,
    port: 5173,
    https: devHttps(),
    proxy: {
      "/bike-api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bike-api/, ""),
      },
    },
  },
})
