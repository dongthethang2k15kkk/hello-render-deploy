-- Hypixel SkyBlock accounts for sale, delivered automatically once the payment is confirmed.
ALTER TABLE "Order" ADD COLUMN "needsAppointment" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "OrderItem" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'package';
ALTER TABLE "OrderItem" ADD COLUMN "accountId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "deliveredSecretEnc" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "deliveredAt" TIMESTAMP(3);
CREATE INDEX "OrderItem_accountId_idx" ON "OrderItem"("accountId");

CREATE TABLE "GameAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ign" TEXT NOT NULL,
    "uuid" TEXT,
    "profileId" TEXT,
    "profileName" TEXT,
    "showIgn" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceVnd" INTEGER NOT NULL,
    "salePriceVnd" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imagePaths" JSONB NOT NULL DEFAULT '[]',
    "stats" JSONB,
    "statsSource" TEXT NOT NULL DEFAULT 'manual',
    "statsLocked" BOOLEAN NOT NULL DEFAULT false,
    "statsFetchedAt" TIMESTAMP(3),
    "statsError" TEXT,
    "secretEnc" TEXT NOT NULL,
    "orderId" TEXT,
    "reservedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameAccount_code_key" ON "GameAccount"("code");
CREATE INDEX "GameAccount_status_sortOrder_idx" ON "GameAccount"("status", "sortOrder");
CREATE INDEX "GameAccount_orderId_idx" ON "GameAccount"("orderId");
CREATE INDEX "GameAccount_statsFetchedAt_idx" ON "GameAccount"("statsFetchedAt");
