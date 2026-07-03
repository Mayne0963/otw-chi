CREATE TYPE "BusinessIndustryType" AS ENUM (
    'PROFESSIONAL_SERVICES',
    'REAL_ESTATE',
    'HEALTHCARE',
    'LEGAL',
    'CONSTRUCTION',
    'HOSPITALITY',
    'RETAIL',
    'MANUFACTURING',
    'LOGISTICS',
    'AUTOMOTIVE',
    'EDUCATION',
    'NONPROFIT',
    'GOVERNMENT',
    'FINANCIAL_SERVICES',
    'TECHNOLOGY',
    'PROPERTY_MANAGEMENT',
    'RELIGIOUS_ORGANIZATION',
    'OTHER'
);

CREATE TABLE "BusinessMembershipProfile" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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

    CONSTRAINT "BusinessMembershipProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessMembershipProfile_membershipId_key" ON "BusinessMembershipProfile"("membershipId");
CREATE UNIQUE INDEX "BusinessMembershipProfile_userId_key" ON "BusinessMembershipProfile"("userId");
CREATE INDEX "BusinessMembershipProfile_industryType_idx" ON "BusinessMembershipProfile"("industryType");
CREATE INDEX "BusinessMembershipProfile_businessLegalName_idx" ON "BusinessMembershipProfile"("businessLegalName");

ALTER TABLE "BusinessMembershipProfile"
ADD CONSTRAINT "BusinessMembershipProfile_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "MembershipSubscription"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "BusinessMembershipProfile"
ADD CONSTRAINT "BusinessMembershipProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
