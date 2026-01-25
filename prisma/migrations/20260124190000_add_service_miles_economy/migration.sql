-- Service Miles economy + driver compensation schema

DO $$ BEGIN
  CREATE TYPE "ServiceMilesTransactionType" AS ENUM ('ADD_MONTHLY', 'DEDUCT_REQUEST', 'ADJUST', 'EXPIRE', 'ROLL_IN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DriverTier" AS ENUM ('PROBATION', 'STANDARD', 'ELITE', 'CONCIERGE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Membership plan extensions
ALTER TABLE "MembershipPlan"
ADD COLUMN IF NOT EXISTS "monthlyServiceMiles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "rolloverCapMiles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "advanceDiscountMax" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "priorityLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "markupFree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "cashAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "peerToPeerAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "allowedServiceTypes" JSONB;

-- DeliveryRequest extensions (nullable to avoid breaking existing rows)
ALTER TABLE "DeliveryRequest"
ADD COLUMN IF NOT EXISTS "scheduledStart" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "serviceMilesBase" INTEGER,
ADD COLUMN IF NOT EXISTS "serviceMilesAdders" INTEGER,
ADD COLUMN IF NOT EXISTS "serviceMilesDiscount" INTEGER,
ADD COLUMN IF NOT EXISTS "serviceMilesFinal" INTEGER,
ADD COLUMN IF NOT EXISTS "quoteBreakdown" JSONB,
ADD COLUMN IF NOT EXISTS "customerRating" INTEGER,
ADD COLUMN IF NOT EXISTS "complaintFlag" BOOLEAN NOT NULL DEFAULT false;

-- DriverProfile extensions
ALTER TABLE "DriverProfile"
ADD COLUMN IF NOT EXISTS "tierLevel" "DriverTier" NOT NULL DEFAULT 'PROBATION',
ADD COLUMN IF NOT EXISTS "hourlyRateCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "bonusEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "bonus5StarCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "performanceMetrics" JSONB;

-- ServiceMilesWallet
CREATE TABLE IF NOT EXISTS "ServiceMilesWallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balanceMiles" INTEGER NOT NULL DEFAULT 0,
  "rolloverBankMiles" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceMilesWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceMilesWallet_userId_key" ON "ServiceMilesWallet"("userId");

ALTER TABLE "ServiceMilesWallet"
DROP CONSTRAINT IF EXISTS "ServiceMilesWallet_userId_fkey";

ALTER TABLE "ServiceMilesWallet"
ADD CONSTRAINT "ServiceMilesWallet_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ServiceMilesLedger
CREATE TABLE IF NOT EXISTS "ServiceMilesLedger" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "transactionType" "ServiceMilesTransactionType" NOT NULL,
  "deliveryRequestId" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceMilesLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceMilesLedger_walletId_idx" ON "ServiceMilesLedger"("walletId");
CREATE INDEX IF NOT EXISTS "ServiceMilesLedger_deliveryRequestId_idx" ON "ServiceMilesLedger"("deliveryRequestId");

ALTER TABLE "ServiceMilesLedger"
DROP CONSTRAINT IF EXISTS "ServiceMilesLedger_walletId_fkey";

ALTER TABLE "ServiceMilesLedger"
ADD CONSTRAINT "ServiceMilesLedger_walletId_fkey"
FOREIGN KEY ("walletId") REFERENCES "ServiceMilesWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceMilesLedger"
DROP CONSTRAINT IF EXISTS "ServiceMilesLedger_deliveryRequestId_fkey";

ALTER TABLE "ServiceMilesLedger"
ADD CONSTRAINT "ServiceMilesLedger_deliveryRequestId_fkey"
FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DriverTimeLog
CREATE TABLE IF NOT EXISTS "DriverTimeLog" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "deliveryRequestId" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "activeMinutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DriverTimeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DriverTimeLog_driverId_idx" ON "DriverTimeLog"("driverId");
CREATE INDEX IF NOT EXISTS "DriverTimeLog_deliveryRequestId_idx" ON "DriverTimeLog"("deliveryRequestId");

ALTER TABLE "DriverTimeLog"
DROP CONSTRAINT IF EXISTS "DriverTimeLog_driverId_fkey";

ALTER TABLE "DriverTimeLog"
ADD CONSTRAINT "DriverTimeLog_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DriverTimeLog"
DROP CONSTRAINT IF EXISTS "DriverTimeLog_deliveryRequestId_fkey";

ALTER TABLE "DriverTimeLog"
ADD CONSTRAINT "DriverTimeLog_deliveryRequestId_fkey"
FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
