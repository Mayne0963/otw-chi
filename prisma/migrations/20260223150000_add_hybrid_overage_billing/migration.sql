-- Create enums for hybrid overage billing
CREATE TYPE "OverageBillingMode" AS ENUM ('INSTANT', 'INVOICE');
CREATE TYPE "OverageStatus" AS ENUM ('NONE', 'PENDING', 'INVOICED', 'PAID', 'FAILED');

-- MembershipPlan overage controls
ALTER TABLE "MembershipPlan"
  ADD COLUMN "overageBillingMode" "OverageBillingMode" NOT NULL DEFAULT 'INSTANT',
  ADD COLUMN "overageRateCentsPerMile" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overageMinimumCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overageCreditLimitCents" INTEGER NOT NULL DEFAULT 0;

-- DeliveryRequest overage snapshot/payment gate
ALTER TABLE "DeliveryRequest"
  ADD COLUMN "milesUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overageMiles" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overageCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overageBillingMode" "OverageBillingMode",
  ADD COLUMN "overageStatus" "OverageStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "overagePaymentIntentId" TEXT,
  ADD COLUMN "overageInvoiceId" TEXT,
  ADD COLUMN "paymentRequired" BOOLEAN NOT NULL DEFAULT false;

-- Overage accrual tables
CREATE TABLE "OverageInvoicePeriod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "status" "OverageStatus" NOT NULL DEFAULT 'PENDING',
  "stripeInvoiceId" TEXT,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OverageInvoicePeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OverageLineItem" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deliveryRequestId" TEXT NOT NULL,
  "overageCents" INTEGER NOT NULL,
  "status" "OverageStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OverageLineItem_pkey" PRIMARY KEY ("id")
);

-- Stripe webhook event idempotency table
CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Constraints / indexes
CREATE UNIQUE INDEX "OverageInvoicePeriod_stripeInvoiceId_key" ON "OverageInvoicePeriod"("stripeInvoiceId");
CREATE UNIQUE INDEX "OverageInvoicePeriod_userId_periodKey_key" ON "OverageInvoicePeriod"("userId", "periodKey");
CREATE INDEX "OverageInvoicePeriod_userId_periodKey_idx" ON "OverageInvoicePeriod"("userId", "periodKey");

CREATE UNIQUE INDEX "OverageLineItem_deliveryRequestId_key" ON "OverageLineItem"("deliveryRequestId");
CREATE INDEX "OverageLineItem_periodId_idx" ON "OverageLineItem"("periodId");
CREATE INDEX "OverageLineItem_userId_idx" ON "OverageLineItem"("userId");

CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

ALTER TABLE "OverageInvoicePeriod"
  ADD CONSTRAINT "OverageInvoicePeriod_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OverageLineItem"
  ADD CONSTRAINT "OverageLineItem_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "OverageInvoicePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OverageLineItem"
  ADD CONSTRAINT "OverageLineItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OverageLineItem"
  ADD CONSTRAINT "OverageLineItem_deliveryRequestId_fkey"
  FOREIGN KEY ("deliveryRequestId") REFERENCES "DeliveryRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill plan overage defaults for hybrid tier policy
UPDATE "MembershipPlan"
SET
  "overageBillingMode" = CASE
    WHEN "name" IN ('OTW ELITE', 'OTW BLACK', 'OTW ENTERPRISE') OR "name" LIKE 'OTW BUSINESS%'
      THEN 'INVOICE'::"OverageBillingMode"
    ELSE 'INSTANT'::"OverageBillingMode"
  END,
  "overageRateCentsPerMile" = 200,
  "overageMinimumCents" = 500,
  "overageCreditLimitCents" = CASE
    WHEN "name" IN ('OTW ELITE', 'OTW BLACK', 'OTW ENTERPRISE') OR "name" LIKE 'OTW BUSINESS%'
      THEN 50000
    ELSE 0
  END;
