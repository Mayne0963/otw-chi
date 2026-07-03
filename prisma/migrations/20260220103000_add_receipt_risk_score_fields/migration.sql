-- AlterTable
ALTER TABLE "ReceiptVerification"
ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "riskBreakdown" JSONB;
