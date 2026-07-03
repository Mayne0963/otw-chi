-- Add idempotency key for atomic submit safety
ALTER TABLE "DeliveryRequest"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "DeliveryRequest_userId_idempotencyKey_key"
ON "DeliveryRequest"("userId", "idempotencyKey");
