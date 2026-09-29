import type { LockState } from "@prisma/client"
import { wgs84ToGcj02 } from "../domain/gcj.js"
import { errors } from "../errors.js"
import { prisma } from "../infra/prisma.js"
import { pushCommandAck } from "../infra/redis.js"
import { syncBike } from "../infra/state.js"
import { recordPoint } from "./points.js"
import { finishFromLock } from "./rides.js"

export interface Uplink {
  bikeId: string
  event: string
  commandId?: string
  lock?: string
  latitude?: number
  longitude?: number
  coord?: string
  accuracy?: number
  battery?: number
  ts?: number
}

function numberOrNull(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function coordinate(body: Uplink) {
  const latitude = numberOrNull(body.latitude)
  const longitude = numberOrNull(body.longitude)
  if (latitude == null || longitude == null) return null
  const converted = body.coord === "wgs84" ? wgs84ToGcj02(longitude, latitude) : { longitude, latitude }
  return {
    latitude: converted.latitude,
    longitude: converted.longitude,
    accuracy: numberOrNull(body.accuracy),
    recordedAt: new Date(numberOrNull(body.ts) ?? Date.now()),
  }
}

export async function handleUplink(body: Uplink) {
  if (!body.bikeId) throw errors.bikeNotFound()
  const bike = await prisma.bike.findUnique({ where: { id: body.bikeId } })
  if (!bike) throw errors.bikeNotFound()
  if (body.event === "heartbeat") return heartbeat(bike.id, body)
  if (body.event === "location") return location(bike.id, body)
  if (body.event === "lock") return lockEvent(bike.id, body)
}

async function heartbeat(bikeId: string, body: Uplink) {
  const battery = numberOrNull(body.battery)
  const bike = await prisma.bike.update({
    where: { id: bikeId },
    data: { battery: battery == null ? undefined : Math.round(battery), lastSeenAt: new Date() },
  })
  await syncBike(bike)
}

async function location(bikeId: string, body: Uplink) {
  const fix = coordinate(body)
  if (!fix) return
  const bike = await prisma.bike.update({
    where: { id: bikeId },
    data: {
      latitude: fix.latitude.toFixed(6),
      longitude: fix.longitude.toFixed(6),
      accuracy: fix.accuracy,
      locationAt: fix.recordedAt,
    },
  })
  await syncBike(bike)
  const ride = await prisma.ride.findFirst({
    where: { bikeId, status: { in: ["riding", "locking"] } },
  })
  if (!ride) return
  await recordPoint(prisma, {
    rideId: ride.id,
    source: "device",
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    recordedAt: fix.recordedAt,
  })
}

async function lockEvent(bikeId: string, body: Uplink) {
  const fix = coordinate(body)
  const lockState = body.lock === "locked" || body.lock === "unlocked" ? (body.lock as LockState) : undefined
  if (!body.commandId) {
    const bike = await prisma.bike.update({
      where: { id: bikeId },
      data: {
        lockState,
        latitude: fix ? fix.latitude.toFixed(6) : undefined,
        longitude: fix ? fix.longitude.toFixed(6) : undefined,
        accuracy: fix?.accuracy ?? undefined,
        locationAt: fix?.recordedAt,
      },
    })
    await syncBike(bike)
    return
  }

  const command = await prisma.deviceCommand.findUnique({ where: { id: body.commandId } })
  if (!command || command.bikeId !== bikeId) {
    await touchLock(bikeId, lockState, fix)
    return
  }
  if (command.action === "lock") {
    const finished = await finishFromLock(command.id, fix)
    if (!finished) {
      await touchLock(bikeId, lockState, fix)
      return
    }
    const bike = await prisma.bike.findUnique({ where: { id: bikeId } })
    if (bike) await syncBike(bike)
    await pushCommandAck(command.id)
    return
  }

  const opened = await prisma.$transaction(async (tx) => {
    const ride = await tx.ride.findUnique({ where: { id: command.rideId } })
    if (!ride || ride.status !== "unlocking") return false
    const updated = await tx.deviceCommand.updateMany({
      where: { id: command.id, status: "pending" },
      data: { status: "acked", ackedAt: new Date() },
    })
    if (updated.count === 0) return false
    const startedAt = new Date()
    await tx.ride.update({ where: { id: ride.id }, data: { status: "riding", startedAt } })
    await tx.bike.update({
      where: { id: bikeId },
      data: {
        status: "riding",
        lockState: lockState ?? "unlocked",
        latitude: fix ? fix.latitude.toFixed(6) : undefined,
        longitude: fix ? fix.longitude.toFixed(6) : undefined,
        accuracy: fix?.accuracy ?? undefined,
        locationAt: fix?.recordedAt,
        battery: numberOrNull(body.battery) == null ? undefined : Math.round(numberOrNull(body.battery) as number),
      },
    })
    if (fix) {
      await recordPoint(tx, {
        rideId: ride.id,
        source: "device",
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        recordedAt: fix.recordedAt,
      })
    }
    await tx.outbox.create({
      data: {
        routingKey: "bike.ride.started",
        payload: {
          rideId: ride.id,
          bikeId,
          userId: ride.userId,
          startedAt: startedAt.getTime(),
        },
      },
    })
    return true
  })
  if (!opened) await touchLock(bikeId, lockState, fix)
  const bike = await prisma.bike.findUnique({ where: { id: bikeId } })
  if (bike) await syncBike(bike)
  if (opened) await pushCommandAck(command.id)
}

async function touchLock(
  bikeId: string,
  lockState: LockState | undefined,
  fix: { latitude: number; longitude: number; accuracy: number | null; recordedAt: Date } | null,
) {
  const bike = await prisma.bike.update({
    where: { id: bikeId },
    data: {
      lockState,
      latitude: fix ? fix.latitude.toFixed(6) : undefined,
      longitude: fix ? fix.longitude.toFixed(6) : undefined,
      accuracy: fix?.accuracy ?? undefined,
      locationAt: fix?.recordedAt,
    },
  })
  await syncBike(bike)
}
