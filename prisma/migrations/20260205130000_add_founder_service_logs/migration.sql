-- CreateEnum
CREATE TYPE "FounderEnergyLevel" AS ENUM ('EASY', 'ANNOYING', 'EXHAUSTING');

-- CreateTable
CREATE TABLE "FounderServiceLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveryRequestId" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "milesCharged" INTEGER NOT NULL,
    "activeMinutes" INTEGER NOT NULL,
    "energy" "FounderEnergyLevel" NOT NULL,
    "wouldDoAgain" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FounderServiceLog_userId_idx" ON "FounderServiceLog"("userId");

-- CreateIndex
CREATE INDEX "FounderServiceLog_createdAt_idx" ON "FounderServiceLog"("createdAt");

-- CreateIndex
CREATE INDEX "FounderServiceLog_deliveryRequestId_idx" ON "FounderServiceLog"("deliveryRequestId");

-- AddForeignKey
ALTER TABLE "FounderServiceLog" ADD CONSTRAINT "FounderServiceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FounderServiceLog" ADD CONSTRAINT "FounderServiceLog_deliveryRequestId_fkey" FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

