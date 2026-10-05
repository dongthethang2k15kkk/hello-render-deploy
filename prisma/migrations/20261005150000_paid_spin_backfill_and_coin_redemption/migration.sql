-- Package purchases unlock spins but do not increase the redeemable wheel-coin balance.
ALTER TABLE "Order"
  ADD COLUMN "redeemWheelCoins" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "wheelCoins" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "wheelCoinsReleasedAt" TIMESTAMP(3);

-- Remove purchase credits created by the earlier implementation. Wheel winnings remain untouched.
WITH "purchaseCredits" AS (
  SELECT "customerId", SUM("amount") AS "amount"
  FROM "CoinLedger"
  WHERE "kind" = 'order_payment'
  GROUP BY "customerId"
)
UPDATE "Customer" AS customer
SET "coinBalance" = GREATEST(0::BIGINT, customer."coinBalance" - credits."amount")
FROM "purchaseCredits" AS credits
WHERE customer."id" = credits."customerId";

DELETE FROM "CoinLedger" WHERE "kind" = 'order_payment';

-- Every historical paid order owns exactly one spin. The unique orderId makes this rerun-safe.
INSERT INTO "LuckySpin" ("id", "customerId", "orderId", "createdAt")
SELECT 'backfill_' || md5(order_row."id"), order_row."customerId", order_row."id", order_row."paidAt"
FROM "Order" AS order_row
WHERE order_row."paidAt" IS NOT NULL
ON CONFLICT ("orderId") DO NOTHING;
