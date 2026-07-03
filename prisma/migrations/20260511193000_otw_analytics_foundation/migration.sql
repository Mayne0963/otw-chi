-- CreateEnum
CREATE TYPE "OtwLeadInterestType" AS ENUM (
  'SERVICE_REQUEST',
  'MEMBERSHIP_INTEREST',
  'DRIVER_INTEREST',
  'BUSINESS_ACCOUNT',
  'FRAGILE_DELIVERY',
  'STORE_PICKUP',
  'FOOD_DELIVERY',
  'ERRAND_SERVICE',
  'PEER_TO_PEER_DELIVERY',
  'GENERAL_CONTACT',
  'LAUNCH_LIST'
);

-- CreateEnum
CREATE TYPE "OtwServiceType" AS ENUM (
  'FOOD_DELIVERY',
  'STORE_PICKUP',
  'FRAGILE_ITEM',
  'PERSONAL_ERRAND',
  'RIDE_SERVICE',
  'PEER_TO_PEER',
  'EVENT_SUPPORT',
  'HOME_WAIT_SERVICE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "OtwSiteEventType" AS ENUM (
  'PAGE_VIEW',
  'CTA_CLICK',
  'SERVICE_VIEW',
  'SERVICE_SELECTED',
  'REQUEST_STARTED',
  'REQUEST_STEP_COMPLETED',
  'REQUEST_SUBMITTED',
  'REQUEST_ABANDONED_SIGNAL',
  'MEMBERSHIP_VIEW',
  'MEMBERSHIP_SELECTED',
  'MEMBERSHIP_CHECKOUT_STARTED',
  'MEMBERSHIP_CHECKOUT_COMPLETED',
  'LOGIN_REQUIRED',
  'DRIVER_APPLICATION_STARTED',
  'DRIVER_APPLICATION_SUBMITTED',
  'CONTACT_SUBMITTED',
  'SUPPORT_CLICKED',
  'ERROR_SHOWN'
);

-- CreateTable
CREATE TABLE "OtwLead" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "interestType" "OtwLeadInterestType" NOT NULL,
  "serviceType" "OtwServiceType",
  "sourcePage" TEXT,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OtwLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtwLead_createdAt_idx" ON "OtwLead"("createdAt");

-- CreateIndex
CREATE INDEX "OtwLead_interestType_createdAt_idx" ON "OtwLead"("interestType", "createdAt");

-- CreateIndex
CREATE INDEX "OtwLead_serviceType_createdAt_idx" ON "OtwLead"("serviceType", "createdAt");

-- CreateTable
CREATE TABLE "OtwSiteEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "customerProfileId" TEXT,
  "eventType" "OtwSiteEventType" NOT NULL,
  "page" TEXT,
  "serviceType" "OtwServiceType",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OtwSiteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtwSiteEvent_createdAt_idx" ON "OtwSiteEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OtwSiteEvent_eventType_createdAt_idx" ON "OtwSiteEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "OtwSiteEvent_serviceType_createdAt_idx" ON "OtwSiteEvent"("serviceType", "createdAt");

-- CreateIndex
CREATE INDEX "OtwSiteEvent_sessionId_createdAt_idx" ON "OtwSiteEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "OtwSiteEvent_userId_createdAt_idx" ON "OtwSiteEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OtwSiteEvent_customerProfileId_createdAt_idx" ON "OtwSiteEvent"("customerProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "OtwSiteEvent"
ADD CONSTRAINT "OtwSiteEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtwSiteEvent"
ADD CONSTRAINT "OtwSiteEvent_customerProfileId_fkey"
FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
