-- Add new fields to ReceiptVerification table
ALTER TABLE "ReceiptVerification" 
ADD COLUMN "proofScore" INTEGER,
ADD COLUMN "extractedTotal" DOUBLE PRECISION,
ADD COLUMN "vendorName" TEXT,
ADD COLUMN "itemMatchScore" INTEGER,
ADD COLUMN "imageQuality" INTEGER,
ADD COLUMN "tamperScore" INTEGER,
ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT FALSE;

-- Create unique constraint for deliveryRequestId
ALTER TABLE "ReceiptVerification" 
ADD CONSTRAINT "ReceiptVerification_deliveryRequestId_key" UNIQUE ("deliveryRequestId");

-- Create ReceiptAudit table
CREATE TABLE "ReceiptAudit" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptAudit_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "ReceiptVerification_proofScore_idx" ON "ReceiptVerification"("proofScore");
CREATE INDEX "ReceiptAudit_deliveryRequestId_idx" ON "ReceiptAudit"("deliveryRequestId");
CREATE INDEX "ReceiptAudit_createdAt_idx" ON "ReceiptAudit"("createdAt");

-- Add foreign key constraint
ALTER TABLE "ReceiptAudit" ADD CONSTRAINT "ReceiptAudit_deliveryRequestId_fkey" 
FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;