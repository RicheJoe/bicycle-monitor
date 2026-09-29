import cors from "cors"
import express from "express"
import { config } from "./config.js"
import { errors } from "./errors.js"
import { errorHandler } from "./http/middleware.js"
import { authRouter, meRouter, placeRouter, rideRouter } from "./http/routes.js"
import { handleUplink, type Uplink } from "./modules/uplink.js"

export function createPublicApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.get("/health", (_req, res) => {
    res.json({ ok: true })
  })
  app.use(authRouter)
  app.use(meRouter)
  app.use(rideRouter)
  app.use(placeRouter)
  app.use(errorHandler)
  return app
}

export function createInternalApp() {
  const app = express()
  app.use(express.json())
  app.post("/internal/mqtt", async (req, res, next) => {
    try {
      if (req.header("x-webhook-secret") !== config.webhookSecret) throw errors.unauthorized()
      await handleUplink(req.body as Uplink)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })
  app.use(errorHandler)
  return app
}
