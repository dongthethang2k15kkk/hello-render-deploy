import type {Prisma} from '@prisma/client';
import {getPaymentDb} from './payment-db';
export {coinsFromOrderItems, coinsFromTitle} from './coin-rules';

export async function creditCoins(tx: Prisma.TransactionClient, input: {customerId: string; amount: bigint; kind: string; sourceKey: string; orderId?: string; spinId?: string; note?: string}) {
  if (input.amount <= BigInt(0)) return false;
  // createMany + skipDuplicates keeps a repeated sourceKey from aborting the surrounding
  // PostgreSQL transaction. Only the call that inserted the ledger row may change the balance.
  const inserted = await tx.coinLedger.createMany({data: [{customerId: input.customerId, amount: input.amount, kind: input.kind, sourceKey: input.sourceKey, orderId: input.orderId, spinId: input.spinId, note: input.note}], skipDuplicates: true});
  if (inserted.count !== 1) return false;
  await tx.customer.update({where: {id: input.customerId}, data: {coinBalance: {increment: input.amount}}});
  return true;
}

/** Locks the customer's entire available wheel balance to one order. The row lock prevents two checkouts from spending it twice. */
export async function reserveAllCoins(tx: Prisma.TransactionClient, input: {customerId: string; orderId: string; sourceKey: string; note?: string}) {
  await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${input.customerId} FOR UPDATE`;
  const customer = await tx.customer.findUniqueOrThrow({where: {id: input.customerId}, select: {coinBalance: true}});
  if (customer.coinBalance <= BigInt(0)) return BigInt(0);
  const amount = customer.coinBalance;
  const inserted = await tx.coinLedger.createMany({data: [{customerId: input.customerId, amount: -amount, kind: 'order_redemption', sourceKey: input.sourceKey, orderId: input.orderId, note: input.note}], skipDuplicates: true});
  if (inserted.count !== 1) return BigInt(0);
  await tx.customer.update({where: {id: input.customerId}, data: {coinBalance: {decrement: amount}}});
  return amount;
}

/** Returns an order's reserved wheel coins once. A unique ledger source keeps retries harmless. */
export async function refundReservedCoins(tx: Prisma.TransactionClient, input: {customerId: string; orderId: string; amount: bigint; sourceKey: string; note?: string}) {
  if (input.amount <= BigInt(0)) return false;
  return creditCoins(tx, {...input, kind: 'order_redemption_refund'});
}

export async function getCoinBalance(customerId: string) {
  const customer = await getPaymentDb().customer.findUnique({where: {id: customerId}, select: {coinBalance: true}});
  return customer?.coinBalance ?? BigInt(0);
}
