-- CreateTable
CREATE TABLE "DriverNavigationSettings" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voiceLocale" TEXT NOT NULL DEFAULT 'en-US',
    "voiceVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "detailLevel" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverNavigationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverTelemetry" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "requestId" TEXT,
    "deliveryRequestId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speedMps" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "batteryLevel" DOUBLE PRECISION,
    "batteryCharging" BOOLEAN,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverNavigationSettings_driverId_key" ON "DriverNavigationSettings"("driverId");

-- CreateIndex
CREATE INDEX "DriverTelemetry_driverId_recordedAt_idx" ON "DriverTelemetry"("driverId", "recordedAt");

-- CreateIndex
CREATE INDEX "DriverTelemetry_requestId_idx" ON "DriverTelemetry"("requestId");

-- CreateIndex
CREATE INDEX "DriverTelemetry_deliveryRequestId_idx" ON "DriverTelemetry"("deliveryRequestId");

-- AddForeignKey
ALTER TABLE "DriverNavigationSettings" ADD CONSTRAINT "DriverNavigationSettings_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverTelemetry" ADD CONSTRAINT "DriverTelemetry_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
