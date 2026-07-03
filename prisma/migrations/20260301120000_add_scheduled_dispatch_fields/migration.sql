ALTER TABLE "DeliveryRequest"
ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "isScheduled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "scheduleWindowMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "dispatchAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "DeliveryRequest_dispatchAt_idx" ON "DeliveryRequest"("dispatchAt");
