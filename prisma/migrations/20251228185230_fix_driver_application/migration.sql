-- Ensure enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverApplicationStatus') THEN
    CREATE TYPE "DriverApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');
  END IF;
END $$;

-- Add missing columns
ALTER TABLE "DriverApplication" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "DriverApplication" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Align availability to nullable
ALTER TABLE "DriverApplication" ALTER COLUMN "availability" DROP NOT NULL;

-- Normalize status values before casting to enum
UPDATE "DriverApplication"
SET "status" = 'PENDING'
WHERE "status" IS NULL OR "status"::text = 'NEW';

-- Convert status to enum if still text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'DriverApplication'
      AND column_name = 'status'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "DriverApplication"
      ALTER COLUMN "status" TYPE "DriverApplicationStatus"
      USING "status"::"DriverApplicationStatus";
  END IF;
END $$;

ALTER TABLE "DriverApplication" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Backfill updatedAt and enforce NOT NULL with default
UPDATE "DriverApplication" SET "updatedAt" = COALESCE("updatedAt", "createdAt") WHERE "updatedAt" IS NULL;
ALTER TABLE "DriverApplication" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DriverApplication" ALTER COLUMN "updatedAt" SET NOT NULL;
