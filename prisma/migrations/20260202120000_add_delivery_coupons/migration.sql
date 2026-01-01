-- Add coupon tracking and receipt subtotal for delivery requests
ALTER TABLE "DeliveryRequest"
ADD COLUMN "receiptSubtotalCents" INTEGER,
ADD COLUMN "couponCode" TEXT,
ADD COLUMN "discountCents" INTEGER;

-- Promo codes and redemptions
CREATE TABLE "PromoCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "percentOff" INTEGER,
  "amountOffCents" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "maxRedemptions" INTEGER,
  "redemptions" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

CREATE TABLE "PromoRedemption" (
  "id" TEXT NOT NULL,
  "promoCodeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoRedemption_promoCodeId_userId_key" ON "PromoRedemption"("promoCodeId", "userId");
CREATE INDEX "PromoRedemption_userId_idx" ON "PromoRedemption"("userId");

ALTER TABLE "PromoRedemption"
ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromoRedemption"
ADD CONSTRAINT "PromoRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
