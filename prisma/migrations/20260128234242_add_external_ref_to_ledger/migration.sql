/*
  Warnings:

  - A unique constraint covering the columns `[driverId,requestId]` on the table `DriverEarnings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalRef]` on the table `ServiceMilesLedger` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DriverEarningStatus" AS ENUM ('pending', 'available', 'paid');

-- CreateEnum
CREATE TYPE "DriverPayoutStatus" AS ENUM ('processing', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('stripe', 'manual');

-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'EN_ROUTE';

-- AlterEnum
ALTER TYPE "ServiceType" ADD VALUE 'RIDE';

-- DropForeignKey
ALTER TABLE "MembershipSubscription" DROP CONSTRAINT "MembershipSubscription_planId_fkey";

-- AlterTable
ALTER TABLE "DriverApplication" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DriverEarnings" ADD COLUMN     "amountCents" INTEGER,
ADD COLUMN     "status" "DriverEarningStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "MembershipSubscription" ALTER COLUMN "planId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ServiceMilesLedger" ADD COLUMN     "externalRef" TEXT;

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'NATIVE',
    "paymentMethodDisplay" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "orderId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverPayout" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" "DriverPayoutStatus" NOT NULL DEFAULT 'processing',
    "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NipTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NipTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverLocation" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentTransaction_userId_createdAt_idx" ON "PaymentTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX "NipTransaction_userId_createdAt_idx" ON "NipTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DriverLocation_driverId_timestamp_idx" ON "DriverLocation"("driverId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "DriverEarnings_driverId_requestId_key" ON "DriverEarnings"("driverId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceMilesLedger_externalRef_key" ON "ServiceMilesLedger"("externalRef");

-- AddForeignKey
ALTER TABLE "MembershipSubscription" ADD CONSTRAINT "MembershipSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NipTransaction" ADD CONSTRAINT "NipTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
