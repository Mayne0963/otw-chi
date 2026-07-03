-- Core-safe pickup verification fields + request chat model

ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "orderReference" TEXT,
  ADD COLUMN IF NOT EXISTS "pickupInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "dropoffInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "pickupCodeType" TEXT,
  ADD COLUMN IF NOT EXISTS "pickupCodeText" TEXT,
  ADD COLUMN IF NOT EXISTS "pickupPassImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "pickupPassUploadedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pickupPassExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "chatClosedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "RequestMessage" (
  "id" TEXT NOT NULL,
  "deliveryRequestId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "senderRole" "Role" NOT NULL,
  "messageText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "RequestMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RequestMessage_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RequestMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RequestMessage_deliveryRequestId_createdAt_idx"
  ON "RequestMessage"("deliveryRequestId", "createdAt");

CREATE INDEX IF NOT EXISTS "RequestMessage_senderUserId_idx"
  ON "RequestMessage"("senderUserId");
