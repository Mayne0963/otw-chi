/*
  Warnings:

  - A unique constraint covering the columns `[driverId,requestId]` on the table `DriverEarnings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalRef]` on the table `ServiceMilesLedger` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverEarningStatus') THEN
    CREATE TYPE "DriverEarningStatus" AS ENUM ('pending', 'available', 'paid');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverPayoutStatus') THEN
    CREATE TYPE "DriverPayoutStatus" AS ENUM ('processing', 'paid', 'failed');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayoutMethod') THEN
    CREATE TYPE "PayoutMethod" AS ENUM ('stripe', 'manual');
  END IF;
END $$;

-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'EN_ROUTE';

-- AlterEnum
ALTER TYPE "ServiceType" ADD VALUE IF NOT EXISTS 'RIDE';

-- DropForeignKey
ALTER TABLE "MembershipSubscription" DROP CONSTRAINT IF EXISTS "MembershipSubscription_planId_fkey";

-- AlterTable
ALTER TABLE "DriverApplication" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DriverEarnings" ADD COLUMN IF NOT EXISTS "amountCents" INTEGER,
ADD COLUMN IF NOT EXISTS "status" "DriverEarningStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "MembershipSubscription" ALTER COLUMN "planId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ServiceMilesLedger" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
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
CREATE TABLE IF NOT EXISTS "DriverPayout" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" "DriverPayoutStatus" NOT NULL DEFAULT 'processing',
    "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NipTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NipTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DriverLocation" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentTransaction_userId_createdAt_idx" ON "PaymentTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NipTransaction_userId_createdAt_idx" ON "NipTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DriverLocation_driverId_timestamp_idx" ON "DriverLocation"("driverId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DriverEarnings_driverId_requestId_key" ON "DriverEarnings"("driverId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceMilesLedger_externalRef_key" ON "ServiceMilesLedger"("externalRef");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'MembershipSubscription_planId_fkey'
  ) THEN
    ALTER TABLE "MembershipSubscription" ADD CONSTRAINT "MembershipSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PaymentTransaction_userId_fkey'
  ) THEN
    ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DriverPayout_driverId_fkey'
  ) THEN
    ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NipTransaction_userId_fkey'
  ) THEN
    ALTER TABLE "NipTransaction" ADD CONSTRAINT "NipTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DriverLocation_driverId_fkey'
  ) THEN
    ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
