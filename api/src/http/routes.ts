import { Router } from "express"
import { config } from "../config.js"
import { errors } from "../errors.js"
import { prisma } from "../infra/prisma.js"
import { asyncRoute, requireAuth } from "./middleware.js"
import { loginDev, loginWechat, profile } from "../modules/auth.js"
import { nearbyBikes, nearbyParking } from "../modules/nearby.js"
import { addUserPoint } from "../modules/points.js"
import { currentRide, listFinished, returnRide, startRide, trackOf } from "../modules/rides.js"

export const authRouter = Router()

authRouter.post(
  "/auth/wechat",
  asyncRoute(async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code : ""
    res.json(await loginWechat(code))
  }),
)

if (config.nodeEnv !== "production") {
  authRouter.post(
    "/auth/dev",
    asyncRoute(async (_req, res) => {
      res.json(await loginDev())
    }),
  )
}

export const meRouter = Router()
meRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await profile(req.userId ?? ""))
  }),
)

function finite(value: unknown) {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export const rideRouter = Router()

rideRouter.get(
  "/rides/current",
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await currentRide(req.userId ?? ""))
  }),
)

rideRouter.get(
  "/rides",
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await listFinished(req.userId ?? ""))
  }),
)

rideRouter.post(
  "/rides",
  requireAuth,
  asyncRoute(async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code : ""
    res.json(await startRide(req.userId ?? "", code))
  }),
)

rideRouter.post(
  "/rides/:id/points",
  requireAuth,
  asyncRoute(async (req, res) => {
    const latitude = finite(req.body?.latitude)
    const longitude = finite(req.body?.longitude)
    const accuracy = finite(req.body?.accuracy)
    const locatedAt = finite(req.body?.locatedAt)
    if (latitude == null || longitude == null || accuracy == null || locatedAt == null) throw errors.badRequest()
    const row = await prisma.ride.findUnique({ where: { id: String(req.params.id) } })
    if (!row || row.userId !== req.userId) throw errors.rideNotFound()
    if (row.status !== "riding" && row.status !== "locking") throw errors.rideNotRiding()
    await addUserPoint(row.id, latitude, longitude, accuracy, new Date(locatedAt))
    res.status(204).end()
  }),
)

rideRouter.get(
  "/rides/:id/track",
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await trackOf(req.userId ?? "", String(req.params.id)))
  }),
)

rideRouter.post(
  "/rides/:id/return",
  requireAuth,
  asyncRoute(async (req, res) => {
    const latitude = finite(req.body?.latitude)
    const longitude = finite(req.body?.longitude)
    const accuracy = finite(req.body?.accuracy)
    const locatedAt = finite(req.body?.locatedAt)
    const code = typeof req.body?.code === "string" ? req.body.code : ""
    if (latitude == null || longitude == null || accuracy == null || locatedAt == null) throw errors.badRequest()
    res.json(
      await returnRide(req.userId ?? "", String(req.params.id), { code, latitude, longitude, accuracy, locatedAt }),
    )
  }),
)

export const placeRouter = Router()

placeRouter.get(
  "/bikes/nearby",
  requireAuth,
  asyncRoute(async (req, res) => {
    const latitude = finite(req.query.latitude)
    const longitude = finite(req.query.longitude)
    if (latitude == null || longitude == null) throw errors.badRequest()
    const radius = finite(req.query.radius) ?? 2000
    res.json(await nearbyBikes(latitude, longitude, Math.min(Math.max(radius, 1), 20_000)))
  }),
)

placeRouter.get(
  "/parking-points/nearby",
  requireAuth,
  asyncRoute(async (req, res) => {
    const latitude = finite(req.query.latitude)
    const longitude = finite(req.query.longitude)
    if (latitude == null || longitude == null) throw errors.badRequest()
    const radius = finite(req.query.radius) ?? 2000
    res.json(await nearbyParking(latitude, longitude, Math.min(Math.max(radius, 1), 20_000)))
  }),
)
