CREATE TABLE IF NOT EXISTS "OtwTrueEmployee" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "employeeUserId" TEXT,
  "employeeEmail" TEXT NOT NULL,
  "employeeName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtwTrueEmployee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OtwTrueEmployeeBenefitYear" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "benefitYear" INTEGER NOT NULL,
  "freeFoodDeliveriesUsed" INTEGER NOT NULL DEFAULT 0,
  "commuteRidesUsed" INTEGER NOT NULL DEFAULT 0,
  "roadsideAssistsUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtwTrueEmployeeBenefitYear_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OtwTrueEmployee_ownerUserId_employeeEmail_key"
ON "OtwTrueEmployee"("ownerUserId", "employeeEmail");

CREATE INDEX IF NOT EXISTS "OtwTrueEmployee_employeeUserId_idx"
ON "OtwTrueEmployee"("employeeUserId");

CREATE INDEX IF NOT EXISTS "OtwTrueEmployee_employeeEmail_idx"
ON "OtwTrueEmployee"("employeeEmail");

CREATE INDEX IF NOT EXISTS "OtwTrueEmployee_isActive_idx"
ON "OtwTrueEmployee"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "OtwTrueEmployeeBenefitYear_employeeId_benefitYear_key"
ON "OtwTrueEmployeeBenefitYear"("employeeId", "benefitYear");

CREATE INDEX IF NOT EXISTS "OtwTrueEmployeeBenefitYear_benefitYear_idx"
ON "OtwTrueEmployeeBenefitYear"("benefitYear");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'OtwTrueEmployee_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "OtwTrueEmployee"
    ADD CONSTRAINT "OtwTrueEmployee_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'OtwTrueEmployee_employeeUserId_fkey'
  ) THEN
    ALTER TABLE "OtwTrueEmployee"
    ADD CONSTRAINT "OtwTrueEmployee_employeeUserId_fkey"
    FOREIGN KEY ("employeeUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'OtwTrueEmployeeBenefitYear_employeeId_fkey'
  ) THEN
    ALTER TABLE "OtwTrueEmployeeBenefitYear"
    ADD CONSTRAINT "OtwTrueEmployeeBenefitYear_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "OtwTrueEmployee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "DeliveryRequest"
ADD COLUMN IF NOT EXISTS "otwTrueBenefitType" TEXT,
ADD COLUMN IF NOT EXISTS "otwTrueOwnerUserId" TEXT,
ADD COLUMN IF NOT EXISTS "otwTrueBenefitYear" INTEGER,
ADD COLUMN IF NOT EXISTS "otwTrueEmployeeId" TEXT;

CREATE INDEX IF NOT EXISTS "DeliveryRequest_otwTrueEmployeeId_idx"
ON "DeliveryRequest"("otwTrueEmployeeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DeliveryRequest_otwTrueEmployeeId_fkey'
  ) THEN
    ALTER TABLE "DeliveryRequest"
    ADD CONSTRAINT "DeliveryRequest_otwTrueEmployeeId_fkey"
    FOREIGN KEY ("otwTrueEmployeeId") REFERENCES "OtwTrueEmployee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
