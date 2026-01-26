-- Add idempotency support to ServiceMilesLedger for webhook/event safety

ALTER TABLE "ServiceMilesLedger"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceMilesLedger_walletId_idempotencyKey_key"
ON "ServiceMilesLedger"("walletId", "idempotencyKey");
