-- Store Stripe checkout session ID for food delivery payments
ALTER TABLE "DeliveryRequest"
ADD COLUMN "deliveryCheckoutSessionId" TEXT;
