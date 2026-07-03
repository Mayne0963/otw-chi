-- CreateTable
CREATE TABLE "AutomationIntakeSubmission" (
    "id" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "businessType" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(10,2) NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "orderSource" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'New',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "followUpSent" BOOLEAN NOT NULL DEFAULT false,
    "stripeLink" TEXT,
    "address" TEXT,
    "pickupAddress" TEXT,
    "dropoffAddress" TEXT,
    "zapierLastAttemptAt" TIMESTAMP(3),
    "zapierDeliveredAt" TIMESTAMP(3),
    "zapierStatusCode" INTEGER,
    "zapierErrorCode" TEXT,
    "zapierErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationIntakeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationIntakeSubmission_businessType_createdAt_idx" ON "AutomationIntakeSubmission"("businessType", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationIntakeSubmission_status_createdAt_idx" ON "AutomationIntakeSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationIntakeSubmission_email_createdAt_idx" ON "AutomationIntakeSubmission"("email", "createdAt");
