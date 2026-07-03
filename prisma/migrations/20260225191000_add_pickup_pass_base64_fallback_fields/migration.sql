ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "pickupPassBase64" TEXT,
  ADD COLUMN IF NOT EXISTS "pickupPassMimeType" TEXT;
