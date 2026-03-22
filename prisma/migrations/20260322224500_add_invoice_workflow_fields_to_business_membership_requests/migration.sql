ALTER TABLE "BusinessMembershipInvoiceRequest"
ADD COLUMN "invoiceWorkflowType" TEXT,
ADD COLUMN "stripeInvoiceId" TEXT,
ADD COLUMN "invoiceStartedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "BusinessMembershipInvoiceRequest_stripeInvoiceId_key"
ON "BusinessMembershipInvoiceRequest"("stripeInvoiceId");

CREATE INDEX "BusinessMembershipInvoiceRequest_invoiceWorkflowType_idx"
ON "BusinessMembershipInvoiceRequest"("invoiceWorkflowType");
