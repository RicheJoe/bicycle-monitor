import { Prisma, type PointSource, type PrismaClient } from "@prisma/client"
import { config } from "../config.js"
import { shouldKeepPoint, type TrackSample } from "../domain/track.js"
import { prisma } from "../infra/prisma.js"

type Db = Prisma.TransactionClient | PrismaClient

function limits() {
  return {
    accuracyLimitM: config.trackAccuracyLimitM,
    minIntervalMs: config.trackMinIntervalMs,
    minDistanceM: config.trackMinDistanceM,
  }
}

export async function recordPoint(
  db: Db,
  input: { rideId: string; source: PointSource; latitude: number; longitude: number; accuracy: number | null; recordedAt: Date },
) {
  const previous = await db.ridePoint.findFirst({
    where: { rideId: input.rideId, source: input.source },
    orderBy: { recordedAt: "desc" },
  })
  const sample: TrackSample = {
    latitude: input.latitude,
    longitude: input.longitude,
    recordedAt: input.recordedAt.getTime(),
    source: input.source,
    accuracy: input.accuracy,
  }
  const prior = previous
    ? {
        latitude: Number(previous.latitude),
        longitude: Number(previous.longitude),
        recordedAt: previous.recordedAt.getTime(),
        source: previous.source,
        accuracy: previous.accuracy,
      }
    : undefined
  if (!shouldKeepPoint(sample, prior, limits())) return false
  await db.ridePoint.create({
    data: {
      rideId: input.rideId,
      source: input.source,
      latitude: input.latitude.toFixed(6),
      longitude: input.longitude.toFixed(6),
      accuracy: input.accuracy,
      recordedAt: input.recordedAt,
    },
  })
  return true
}

export async function addUserPoint(rideId: string, latitude: number, longitude: number, accuracy: number, recordedAt: Date) {
  return recordPoint(prisma, { rideId, source: "user", latitude, longitude, accuracy, recordedAt })
}
