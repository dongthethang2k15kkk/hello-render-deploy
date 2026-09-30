-- Automatic payment detection (SePay webhook, Litecoin blockchain), ASAP appointments and reminders.
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "asap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentSeenAt" TIMESTAMP(3),
ADD COLUMN     "paymentSource" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "txConfirmations" INTEGER;

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "referenceCode" TEXT,
    "accountNumber" TEXT,
    "gateway" TEXT,
    "orderId" TEXT,
    "outcome" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankTransaction_receivedAt_idx" ON "BankTransaction"("receivedAt");

-- CreateIndex
CREATE INDEX "BankTransaction_orderId_idx" ON "BankTransaction"("orderId");

