CREATE TYPE "BusinessMembershipInvoiceRequestStatus" AS ENUM (
    'PENDING',
    'REVIEWED',
    'CONVERTED',
    'CLOSED'
);

CREATE TABLE "BusinessMembershipInvoiceRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "planName" TEXT NOT NULL,
    "status" "BusinessMembershipInvoiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "businessLegalName" TEXT NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "primaryBusinessStreetAddress" TEXT NOT NULL,
    "primaryBusinessCity" TEXT NOT NULL,
    "primaryBusinessStateProvince" TEXT NOT NULL,
    "primaryBusinessPostalCode" TEXT NOT NULL,
    "primaryBusinessCountry" TEXT NOT NULL,
    "industryType" "BusinessIndustryType" NOT NULL,
    "primaryContactFullName" TEXT NOT NULL,
    "primaryContactEmail" TEXT NOT NULL,
    "primaryContactPhone" TEXT NOT NULL,
    "businessWebsiteUrl" TEXT,
    "taxIdVatNumber" TEXT,
    "validatedAddress" TEXT,
    "addressValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessMembershipInvoiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessMembershipInvoiceRequest_status_createdAt_idx"
ON "BusinessMembershipInvoiceRequest"("status", "createdAt");

CREATE INDEX "BusinessMembershipInvoiceRequest_planName_idx"
ON "BusinessMembershipInvoiceRequest"("planName");

CREATE INDEX "BusinessMembershipInvoiceRequest_userId_idx"
ON "BusinessMembershipInvoiceRequest"("userId");

ALTER TABLE "BusinessMembershipInvoiceRequest"
ADD CONSTRAINT "BusinessMembershipInvoiceRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
