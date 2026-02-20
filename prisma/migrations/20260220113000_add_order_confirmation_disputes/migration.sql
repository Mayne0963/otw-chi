-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('NONE', 'OPEN', 'NEEDS_INFO', 'RESOLVED_APPROVED', 'RESOLVED_DENIED');

-- CreateTable
CREATE TABLE "OrderConfirmation" (
    "id" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemsSnapshot" JSONB NOT NULL,
    "totalSnapshot" DECIMAL(65,30),
    "customerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "disputeStatus" "DisputeStatus" NOT NULL DEFAULT 'NONE',
    "disputedItems" JSONB,
    "disputeNotes" TEXT,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "receiptVerificationId" TEXT,
    "resolutionNotes" TEXT,
    "refundAmount" DECIMAL(65,30),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderConfirmation_deliveryRequestId_key" ON "OrderConfirmation"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "OrderConfirmation_userId_idx" ON "OrderConfirmation"("userId");

-- CreateIndex
CREATE INDEX "OrderConfirmation_disputeStatus_idx" ON "OrderConfirmation"("disputeStatus");

-- CreateIndex
CREATE INDEX "OrderConfirmation_createdAt_idx" ON "OrderConfirmation"("createdAt");

-- CreateIndex
CREATE INDEX "OrderConfirmation_receiptVerificationId_idx" ON "OrderConfirmation"("receiptVerificationId");

-- AddForeignKey
ALTER TABLE "OrderConfirmation" ADD CONSTRAINT "OrderConfirmation_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConfirmation" ADD CONSTRAINT "OrderConfirmation_receiptVerificationId_fkey" FOREIGN KEY ("receiptVerificationId") REFERENCES "ReceiptVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
