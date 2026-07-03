ALTER TABLE "DeliveryRequest"
  ADD COLUMN IF NOT EXISTS "deliveryPaymentIntentId" TEXT;
