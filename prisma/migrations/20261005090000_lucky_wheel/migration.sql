-- Lucky wheel: one server-controlled spin is granted for every successfully paid order.
CREATE TABLE "LuckyWheelPrize" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "coinAmount" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LuckyWheelPrize_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LuckySpin" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "prizeId" TEXT,
    "prizeLabel" TEXT,
    "coinAmount" INTEGER,
    "spunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LuckySpin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LuckySpin_orderId_key" ON "LuckySpin"("orderId");
CREATE INDEX "LuckyWheelPrize_active_sortOrder_idx" ON "LuckyWheelPrize"("active", "sortOrder");
CREATE INDEX "LuckySpin_customerId_spunAt_idx" ON "LuckySpin"("customerId", "spunAt");
CREATE INDEX "LuckySpin_prizeId_spunAt_idx" ON "LuckySpin"("prizeId", "spunAt");

ALTER TABLE "LuckySpin" ADD CONSTRAINT "LuckySpin_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LuckySpin" ADD CONSTRAINT "LuckySpin_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LuckySpin" ADD CONSTRAINT "LuckySpin_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "LuckyWheelPrize"("id") ON DELETE SET NULL ON UPDATE CASCADE;
