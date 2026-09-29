-- CreateEnum
CREATE TYPE "BikeStatus" AS ENUM ('idle', 'reserved', 'riding', 'maintenance');

-- CreateEnum
CREATE TYPE "LockState" AS ENUM ('locked', 'unlocked', 'unknown');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('unlocking', 'riding', 'locking', 'finished', 'cancelled');

-- CreateEnum
CREATE TYPE "CommandAction" AS ENUM ('unlock', 'lock');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('pending', 'acked', 'timeout');

-- CreateEnum
CREATE TYPE "AttemptResult" AS ENUM ('accepted', 'rejected');

-- CreateEnum
CREATE TYPE "PointSource" AS ENUM ('user', 'device');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "openid" TEXT,
    "nickname" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bike" (
    "id" TEXT NOT NULL,
    "bodyCode" TEXT NOT NULL,
    "status" "BikeStatus" NOT NULL DEFAULT 'idle',
    "lockState" "LockState" NOT NULL DEFAULT 'unknown',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "accuracy" DOUBLE PRECISION,
    "battery" INTEGER,
    "locationAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingPoint" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "radius" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER,

    CONSTRAINT "ParkingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bikeId" TEXT NOT NULL,
    "status" "RideStatus" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "parkingPointId" TEXT,
    "feeCents" INTEGER,
    "distanceMeters" INTEGER,
    "track" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "bikeId" TEXT NOT NULL,
    "action" "CommandAction" NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ackedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnAttempt" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "locatedAt" TIMESTAMP(3) NOT NULL,
    "result" "AttemptResult" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RidePoint" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "source" "PointSource" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RidePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "routingKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_openid_key" ON "User"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "Bike_bodyCode_key" ON "Bike"("bodyCode");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingPoint_code_key" ON "ParkingPoint"("code");

-- CreateIndex
CREATE INDEX "RidePoint_rideId_recordedAt_idx" ON "RidePoint"("rideId", "recordedAt");

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_parkingPointId_fkey" FOREIGN KEY ("parkingPointId") REFERENCES "ParkingPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnAttempt" ADD CONSTRAINT "ReturnAttempt_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RidePoint" ADD CONSTRAINT "RidePoint_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 同一用户、同一车辆在等待开锁、骑行中、等待关锁时只能有一笔订单
CREATE UNIQUE INDEX "ride_one_active_per_user"
  ON "Ride" ("userId")
  WHERE status IN ('unlocking'::"RideStatus", 'riding'::"RideStatus", 'locking'::"RideStatus");

CREATE UNIQUE INDEX "ride_one_active_per_bike"
  ON "Ride" ("bikeId")
  WHERE status IN ('unlocking'::"RideStatus", 'riding'::"RideStatus", 'locking'::"RideStatus");
