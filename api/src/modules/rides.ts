import { randomUUID } from "node:crypto"
import { Prisma, type BikeStatus, type RideStatus } from "@prisma/client"
import { config, activeRideStatuses } from "../config.js"
import { feeCents, formatDuration, yuanFromCents } from "../domain/fee.js"
import { parseCode } from "../domain/qr.js"
import { checkReturn } from "../domain/return-check.js"
import { ApiError, errors } from "../errors.js"
import { prisma } from "../infra/prisma.js"
import { publishCommand } from "../infra/mqtt.js"
import { acquireReturnLock, releaseReturnLock, waitForCommand } from "../infra/redis.js"
import { syncBike } from "../infra/state.js"
import { recordPoint } from "./points.js"

const active = [...activeRideStatuses]

function dayStamp(now: Date) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

async function nextRideId(tx: Prisma.TransactionClient, now: Date) {
  const prefix = `R${dayStamp(now)}`
  const latest = await tx.ride.findFirst({
    where: { id: { startsWith: prefix } },
    orderBy: { id: "desc" },
    select: { id: true },
  })
  const seq = latest ? Number(latest.id.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

function presentRide(ride: { id: string; bikeId: string; startedAt: Date | null }) {
  return { id: ride.id, bikeCode: ride.bikeId, startedAt: ride.startedAt?.getTime() ?? null }
}

function mapUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = JSON.stringify(error.meta ?? {})
    if (target.includes("per_user")) throw errors.activeRide()
    throw errors.bikeUnavailable()
  }
  throw error
}

export async function currentRide(userId: string) {
  const ride = await prisma.ride.findFirst({
    where: { userId, status: { in: active } },
    orderBy: { createdAt: "desc" },
  })
  return { ride: ride ? presentRide(ride) : null }
}

export async function listFinished(userId: string) {
  const rides = await prisma.ride.findMany({
    where: { userId, status: "finished", feeCents: { not: null } },
    include: { parkingPoint: true },
    orderBy: { endedAt: "desc" },
  })
  return {
    orders: rides.map((ride) => ({
      id: ride.id,
      bikeCode: ride.bikeId,
      startedAt: ride.startedAt?.getTime() ?? 0,
      endedAt: ride.endedAt?.getTime() ?? 0,
      fee: yuanFromCents(ride.feeCents ?? 0),
      parkingName: ride.parkingPoint?.name ?? "",
    })),
  }
}

async function loadOwnedRide(userId: string, rideId: string) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } })
  if (!ride || ride.userId !== userId) throw errors.rideNotFound()
  return ride
}

export async function startRide(userId: string, rawCode: string) {
  const code = parseCode(rawCode, "b")
  if (!code) throw errors.bikeUnavailable()
  const commandId = randomUUID()
  const now = new Date()
  let created: { rideId: string; bikeId: string } | null = null
  try {
    created = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: BikeStatus }>>`
        SELECT id, status FROM "Bike" WHERE "bodyCode" = ${code} FOR UPDATE
      `
      const bike = rows[0]
      if (!bike || bike.status !== "idle") throw errors.bikeUnavailable()
      const existing = await tx.ride.findFirst({ where: { userId, status: { in: active } } })
      if (existing) throw errors.activeRide()
      const rideId = await nextRideId(tx, now)
      await tx.bike.update({ where: { id: bike.id }, data: { status: "reserved" } })
      await tx.ride.create({ data: { id: rideId, userId, bikeId: bike.id, status: "unlocking" } })
      await tx.deviceCommand.create({
        data: { id: commandId, rideId, bikeId: bike.id, action: "unlock" },
      })
      return { rideId, bikeId: bike.id }
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    mapUnique(error)
  }
  if (!created) throw errors.bikeUnavailable()

  try {
    await publishCommand(created.bikeId, "unlock", commandId, created.rideId)
  } catch (error) {
    console.error(error)
    await timeoutUnlock(commandId)
    throw errors.lockTimeout()
  }
  const bike = await prisma.bike.findUniqueOrThrow({ where: { id: created.bikeId } })
  await syncBike(bike)

  const acked = await waitForCommand(commandId, config.commandTimeoutMs)
  if (!acked) {
    await timeoutUnlock(commandId)
    throw errors.lockTimeout()
  }
  const ride = await prisma.ride.findUniqueOrThrow({ where: { id: created.rideId } })
  if (ride.status !== "riding") throw errors.lockTimeout()
  return { ride: presentRide(ride) }
}

async function timeoutUnlock(commandId: string) {
  const command = await prisma.deviceCommand.findUnique({ where: { id: commandId } })
  if (!command) return
  await prisma.$transaction(async (tx) => {
    const updated = await tx.deviceCommand.updateMany({
      where: { id: commandId, status: "pending" },
      data: { status: "timeout" },
    })
    if (updated.count === 0) return
    await tx.ride.updateMany({
      where: { id: command.rideId, status: "unlocking" },
      data: { status: "cancelled" },
    })
    await tx.bike.updateMany({
      where: { id: command.bikeId, status: "reserved" },
      data: { status: "idle" },
    })
  })
  const bike = await prisma.bike.findUnique({ where: { id: command.bikeId } })
  if (bike) await syncBike(bike)
}

export async function returnRide(
  userId: string,
  rideId: string,
  input: { code: string; latitude: number; longitude: number; accuracy: number; locatedAt: number },
) {
  const ride = await loadOwnedRide(userId, rideId)
  if (ride.status === "finished") return finishedBody(ride.id)
  if (ride.status === "locking") throw errors.returnInProgress()
  if (ride.status !== "riding") throw errors.noActiveRide()

  const code = parseCode(input.code, "p")
  const spot = code ? await prisma.parkingPoint.findUnique({ where: { code } }) : null
  const bike = await prisma.bike.findUniqueOrThrow({ where: { id: ride.bikeId } })
  const failure = checkReturn({
    accuracy: input.accuracy,
    user: { latitude: input.latitude, longitude: input.longitude },
    spot: spot
      ? {
          latitude: Number(spot.latitude),
          longitude: Number(spot.longitude),
          radius: spot.radius,
          enabled: spot.enabled,
        }
      : null,
    bike:
      bike.latitude != null && bike.longitude != null
        ? {
            latitude: Number(bike.latitude),
            longitude: Number(bike.longitude),
            locationAt: bike.locationAt?.getTime() ?? null,
          }
        : null,
    limits: {
      accuracyLimitM: config.accuracyLimitM,
      zoneBufferM: config.zoneBufferM,
      bikeUserDistanceM: config.bikeUserDistanceM,
      bikeLocationMaxAgeMs: config.bikeLocationMaxAgeMs,
      now: Date.now(),
    },
  })
  if (failure) {
    await prisma.returnAttempt.create({
      data: {
        rideId,
        code: code || input.code,
        latitude: input.latitude.toFixed(6),
        longitude: input.longitude.toFixed(6),
        accuracy: input.accuracy,
        locatedAt: new Date(input.locatedAt),
        result: "rejected",
        reason: failure.message,
      },
    })
    throw failure
  }
  if (!spot) throw errors.invalidQr()

  const token = randomUUID()
  const locked = await acquireReturnLock(rideId, token)
  if (!locked) throw errors.returnInProgress()
  const commandId = randomUUID()
  try {
    const current = await prisma.ride.findUnique({ where: { id: rideId } })
    if (current?.status === "finished") return finishedBody(rideId)
    if (current?.status === "locking") throw errors.returnInProgress()
    if (current?.status !== "riding") throw errors.noActiveRide()
    await prisma.$transaction(async (tx) => {
      await tx.ride.update({ where: { id: rideId }, data: { status: "locking" } })
      await tx.deviceCommand.create({
        data: { id: commandId, rideId, bikeId: ride.bikeId, action: "lock" },
      })
      await tx.returnAttempt.create({
        data: {
          rideId,
          code: spot.code,
          latitude: input.latitude.toFixed(6),
          longitude: input.longitude.toFixed(6),
          accuracy: input.accuracy,
          locatedAt: new Date(input.locatedAt),
          result: "accepted",
        },
      })
    })
    try {
      await publishCommand(ride.bikeId, "lock", commandId, rideId)
    } catch (error) {
      console.error(error)
      await timeoutLock(commandId)
      throw errors.lockTimeout()
    }
    const acked = await waitForCommand(commandId, config.commandTimeoutMs)
    if (!acked) {
      await timeoutLock(commandId)
      throw errors.lockTimeout()
    }
    return finishedBody(rideId)
  } finally {
    await releaseReturnLock(rideId, token)
  }
}

async function timeoutLock(commandId: string) {
  const command = await prisma.deviceCommand.findUnique({ where: { id: commandId } })
  if (!command) return
  await prisma.$transaction(async (tx) => {
    const updated = await tx.deviceCommand.updateMany({
      where: { id: commandId, status: "pending" },
      data: { status: "timeout" },
    })
    if (updated.count === 0) return
    await tx.ride.updateMany({
      where: { id: command.rideId, status: "locking" },
      data: { status: "riding" satisfies RideStatus },
    })
  })
}

async function finishedBody(rideId: string) {
  const ride = await prisma.ride.findUniqueOrThrow({
    where: { id: rideId },
    include: { parkingPoint: true },
  })
  return {
    spotName: ride.parkingPoint?.name ?? "",
    duration: formatDuration(ride.startedAt?.getTime() ?? Date.now(), ride.endedAt?.getTime() ?? Date.now()),
    fee: yuanFromCents(ride.feeCents ?? feeCents(ride.startedAt?.getTime() ?? Date.now(), ride.endedAt?.getTime() ?? Date.now())),
    endedAt: ride.endedAt?.getTime() ?? Date.now(),
  }
}

export async function trackOf(userId: string, rideId: string) {
  const ride = await loadOwnedRide(userId, rideId)
  if (ride.status === "finished" && Array.isArray(ride.track)) {
    return { distanceMeters: ride.distanceMeters ?? 0, points: ride.track }
  }
  const rows = await prisma.ridePoint.findMany({
    where: { rideId },
    orderBy: { recordedAt: "asc" },
  })
  const { buildTrack } = await import("../domain/track.js")
  return buildTrack(
    rows.map((row) => ({
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      recordedAt: row.recordedAt.getTime(),
      source: row.source,
    })),
  )
}

export async function finishFromLock(commandId: string, bikeFix: { latitude: number; longitude: number; accuracy: number | null; recordedAt: Date } | null) {
  const command = await prisma.deviceCommand.findUnique({ where: { id: commandId } })
  if (!command || command.action !== "lock") return false
  const finished = await prisma.$transaction(async (tx) => {
    const ride = await tx.ride.findUnique({ where: { id: command.rideId } })
    if (!ride || ride.status !== "locking" || !ride.startedAt) return false
    const updated = await tx.deviceCommand.updateMany({
      where: { id: commandId, status: "pending" },
      data: { status: "acked", ackedAt: new Date() },
    })
    if (updated.count === 0) return false
    const attempt = await tx.returnAttempt.findFirst({
      where: { rideId: ride.id, result: "accepted" },
      orderBy: { createdAt: "desc" },
    })
    const spot = attempt ? await tx.parkingPoint.findUnique({ where: { code: attempt.code } }) : null
    const endedAt = new Date()
    const cents = feeCents(ride.startedAt.getTime(), endedAt.getTime())
    const latitude = bikeFix?.latitude ?? (attempt ? Number(attempt.latitude) : null)
    const longitude = bikeFix?.longitude ?? (attempt ? Number(attempt.longitude) : null)
    await tx.ride.update({
      where: { id: ride.id },
      data: {
        status: "finished",
        endedAt,
        feeCents: cents,
        parkingPointId: spot?.id,
      },
    })
    await tx.bike.update({
      where: { id: ride.bikeId },
      data: {
        status: "idle",
        lockState: "locked",
        latitude: latitude == null ? undefined : latitude.toFixed(6),
        longitude: longitude == null ? undefined : longitude.toFixed(6),
        accuracy: bikeFix?.accuracy ?? undefined,
        locationAt: bikeFix ? bikeFix.recordedAt : undefined,
      },
    })
    if (attempt) {
      await recordPoint(tx, {
        rideId: ride.id,
        source: "user",
        latitude: Number(attempt.latitude),
        longitude: Number(attempt.longitude),
        accuracy: attempt.accuracy,
        recordedAt: attempt.locatedAt,
      })
    }
    if (bikeFix) {
      await recordPoint(tx, {
        rideId: ride.id,
        source: "device",
        latitude: bikeFix.latitude,
        longitude: bikeFix.longitude,
        accuracy: bikeFix.accuracy,
        recordedAt: bikeFix.recordedAt,
      })
    }
    await tx.outbox.create({
      data: {
        routingKey: "bike.ride.finished",
        payload: {
          rideId: ride.id,
          bikeId: ride.bikeId,
          userId: ride.userId,
          startedAt: ride.startedAt.getTime(),
          endedAt: endedAt.getTime(),
          feeCents: cents,
          parkingPointId: spot?.id ?? null,
        },
      },
    })
    return true
  })
  return finished
}
