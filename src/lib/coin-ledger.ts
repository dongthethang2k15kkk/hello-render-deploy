import type {Prisma} from '@prisma/client';
import {getPaymentDb} from './payment-db';

const UNIT_MULTIPLIER: Record<string, bigint> = {K: BigInt(1000), M: BigInt(1000000), B: BigInt(1000000000), T: BigInt(1000000000000)};

export function coinsFromTitle(title: string, quantity: number) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([KMBT])\b/i.exec(title);
  if (!match || !Number.isInteger(quantity) || quantity < 1) return BigInt(0);
  const [whole, fraction = ''] = match[1].split('.');
  const multiplier = UNIT_MULTIPLIER[match[2].toUpperCase()];
  const scale = BigInt(10) ** BigInt(fraction.length);
  const numeric = BigInt(whole) * scale + BigInt(fraction || '0');
  return numeric * multiplier * BigInt(quantity) / scale;
}

export function coinsFromOrderItems(items: Array<{title: string; quantity: number}>) {
  return items.reduce((sum, item) => sum + coinsFromTitle(item.title, item.quantity), BigInt(0));
}

export async function creditCoins(tx: Prisma.TransactionClient, input: {customerId: string; amount: bigint; kind: string; sourceKey: string; orderId?: string; spinId?: string; note?: string}) {
  if (input.amount <= BigInt(0)) return false;
  // createMany + skipDuplicates keeps a repeated sourceKey from aborting the surrounding
  // PostgreSQL transaction. Only the call that inserted the ledger row may change the balance.
  const inserted = await tx.coinLedger.createMany({data: [{customerId: input.customerId, amount: input.amount, kind: input.kind, sourceKey: input.sourceKey, orderId: input.orderId, spinId: input.spinId, note: input.note}], skipDuplicates: true});
  if (inserted.count !== 1) return false;
  await tx.customer.update({where: {id: input.customerId}, data: {coinBalance: {increment: input.amount}}});
  return true;
}

export async function getCoinBalance(customerId: string) {
  const customer = await getPaymentDb().customer.findUnique({where: {id: customerId}, select: {coinBalance: true}});
  return customer?.coinBalance ?? BigInt(0);
}
