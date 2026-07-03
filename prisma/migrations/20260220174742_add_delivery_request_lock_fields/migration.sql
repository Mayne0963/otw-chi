-- CreateEnum
CREATE TYPE "RefundPolicy" AS ENUM ('AUTO_ALLOWED', 'LOCKED_REQUIRES_REVIEW');

-- AlterTable
ALTER TABLE "DeliveryRequest" ADD COLUMN     "confirmationId" TEXT,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockReason" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "receiptVerificationId" TEXT,
ADD COLUMN     "refundPolicy" "RefundPolicy" NOT NULL DEFAULT 'AUTO_ALLOWED';

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveryRequestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_deliveryRequestId_idx" ON "AuditLog"("deliveryRequestId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "OrderConfirmation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
