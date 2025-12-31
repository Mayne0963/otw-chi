-- Add restaurant + receipt capture fields for food pickup workflow
ALTER TABLE "DeliveryRequest"
ADD COLUMN "restaurantName" TEXT,
ADD COLUMN "restaurantWebsite" TEXT,
ADD COLUMN "receiptImageData" TEXT,
ADD COLUMN "receiptVendor" TEXT,
ADD COLUMN "receiptLocation" TEXT,
ADD COLUMN "receiptItems" JSONB,
ADD COLUMN "receiptAuthenticityScore" DOUBLE PRECISION,
ADD COLUMN "deliveryFeeCents" INTEGER,
ADD COLUMN "deliveryFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receiptVerifiedAt" TIMESTAMP(3);
