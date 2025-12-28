-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryRequestStatus') THEN
    CREATE TYPE "DeliveryRequestStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED', 'CANCELED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeliveryRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedDriverId" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "notes" TEXT,
    "status" "DeliveryRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "lastKnownLat" DOUBLE PRECISION,
    "lastKnownLng" DOUBLE PRECISION,
    "lastKnownAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DriverAssignment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "driverId" TEXT NOT NULL,
    "deliveryRequestId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DriverLocationPing" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "requestId" TEXT,
    "deliveryRequestId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverLocationPing_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DriverAssignment" ADD COLUMN IF NOT EXISTS "deliveryRequestId" TEXT;
ALTER TABLE "DriverAssignment" ALTER COLUMN "requestId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DriverLocationPing" ADD COLUMN IF NOT EXISTS "deliveryRequestId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryRequest_userId_idx" ON "DeliveryRequest"("userId");
CREATE INDEX IF NOT EXISTS "DeliveryRequest_status_idx" ON "DeliveryRequest"("status");
CREATE INDEX IF NOT EXISTS "DriverAssignment_requestId_idx" ON "DriverAssignment"("requestId");
CREATE INDEX IF NOT EXISTS "DriverAssignment_driverId_idx" ON "DriverAssignment"("driverId");
CREATE INDEX IF NOT EXISTS "DriverAssignment_deliveryRequestId_idx" ON "DriverAssignment"("deliveryRequestId");
CREATE INDEX IF NOT EXISTS "DriverLocationPing_driverId_idx" ON "DriverLocationPing"("driverId");
CREATE INDEX IF NOT EXISTS "DriverLocationPing_requestId_idx" ON "DriverLocationPing"("requestId");
CREATE INDEX IF NOT EXISTS "DriverLocationPing_deliveryRequestId_idx" ON "DriverLocationPing"("deliveryRequestId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryRequest_userId_fkey') THEN
    ALTER TABLE "DeliveryRequest" ADD CONSTRAINT "DeliveryRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryRequest_assignedDriverId_fkey') THEN
    ALTER TABLE "DeliveryRequest" ADD CONSTRAINT "DeliveryRequest_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverAssignment_requestId_fkey') THEN
    ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverAssignment_driverId_fkey') THEN
    ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverAssignment_deliveryRequestId_fkey') THEN
    ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverLocationPing_driverId_fkey') THEN
    ALTER TABLE "DriverLocationPing" ADD CONSTRAINT "DriverLocationPing_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverLocationPing_requestId_fkey') THEN
    ALTER TABLE "DriverLocationPing" ADD CONSTRAINT "DriverLocationPing_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverLocationPing_deliveryRequestId_fkey') THEN
    ALTER TABLE "DriverLocationPing" ADD CONSTRAINT "DriverLocationPing_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
