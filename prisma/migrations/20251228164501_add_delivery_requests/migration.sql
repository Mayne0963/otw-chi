-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryRequestStatus') THEN
    CREATE TYPE "DeliveryRequestStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED', 'CANCELED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE "DeliveryRequest" (
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

-- AlterTable
ALTER TABLE "DriverAssignment" ADD COLUMN "deliveryRequestId" TEXT;
ALTER TABLE "DriverAssignment" ALTER COLUMN "requestId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DriverLocationPing" ADD COLUMN "deliveryRequestId" TEXT;

-- CreateIndex
CREATE INDEX "DeliveryRequest_userId_idx" ON "DeliveryRequest"("userId");
CREATE INDEX "DeliveryRequest_status_idx" ON "DeliveryRequest"("status");
CREATE INDEX "DriverAssignment_deliveryRequestId_idx" ON "DriverAssignment"("deliveryRequestId");
CREATE INDEX "DriverLocationPing_deliveryRequestId_idx" ON "DriverLocationPing"("deliveryRequestId");

-- AddForeignKey
ALTER TABLE "DeliveryRequest" ADD CONSTRAINT "DeliveryRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryRequest" ADD CONSTRAINT "DeliveryRequest_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAssignment" ADD CONSTRAINT "DriverAssignment_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriverLocationPing" ADD CONSTRAINT "DriverLocationPing_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
