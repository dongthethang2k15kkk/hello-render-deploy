-- Litecoin payments: wallets, per-order payment method, crypto amount, locked rate and customer TXID.
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cryptoAmount" TEXT,
ADD COLUMN     "cryptoRateVnd" INTEGER,
ADD COLUMN     "customerTxid" TEXT,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'bank';

-- CreateTable
CREATE TABLE "CryptoWallet" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'LTC',
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastAssigned" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryptoWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CryptoWallet_address_key" ON "CryptoWallet"("address");

