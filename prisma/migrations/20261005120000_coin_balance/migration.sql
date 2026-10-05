-- Persistent customer coin balances with an append-only, idempotent credit ledger.
ALTER TABLE "Customer" ADD COLUMN "coinBalance" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "CoinLedger" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "orderId" TEXT,
    "spinId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoinLedger_sourceKey_key" ON "CoinLedger"("sourceKey");
CREATE INDEX "CoinLedger_customerId_createdAt_idx" ON "CoinLedger"("customerId", "createdAt");
CREATE INDEX "CoinLedger_orderId_idx" ON "CoinLedger"("orderId");
CREATE INDEX "CoinLedger_spinId_idx" ON "CoinLedger"("spinId");

ALTER TABLE "CoinLedger" ADD CONSTRAINT "CoinLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
