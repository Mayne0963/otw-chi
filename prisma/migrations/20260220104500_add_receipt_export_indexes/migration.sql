-- CreateIndex
CREATE INDEX "ReceiptVerification_createdAt_idx" ON "ReceiptVerification"("createdAt");

-- CreateIndex
CREATE INDEX "ReceiptVerification_status_idx" ON "ReceiptVerification"("status");

-- CreateIndex
CREATE INDEX "ReceiptVerification_riskScore_idx" ON "ReceiptVerification"("riskScore");
