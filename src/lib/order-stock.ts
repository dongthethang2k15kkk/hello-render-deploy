import 'server-only';
import type {Prisma} from '@prisma/client';
import {RELEASED_NOTE} from './account-rules';

type Tx = Prisma.TransactionClient;

/**
 * Returns an order's items (cancelled or expired orders). Packages go back into stock. A game account that was not delivered
 * goes back on sale; one whose login was already handed over is hidden, never relisted by itself.
 */
export async function restockItems(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({where: {orderId}, select: {packageId: true, quantity: true, kind: true, accountId: true, deliveredAt: true}});
  for (const item of items) {
    if (item.kind !== 'account') { await tx.package.updateMany({where: {id: item.packageId}, data: {stockOnHand: {increment: item.quantity}}}); continue; }
    if (!item.accountId) continue;
    if (item.deliveredAt) await tx.gameAccount.updateMany({where: {id: item.accountId, orderId}, data: {status: 'hidden', adminNote: RELEASED_NOTE}});
    else await tx.gameAccount.updateMany({where: {id: item.accountId, orderId, status: 'reserved'}, data: {status: 'available', orderId: null, reservedAt: null}});
  }
}

export class StockError extends Error {}

/** Takes an expired order's items back out of stock when a late payment revives it; fails if stock ran out or an account was sold on. */
export async function reReserveItems(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({where: {orderId}, select: {packageId: true, quantity: true, kind: true, accountId: true}});
  for (const item of items) {
    if (item.kind === 'account') {
      const reserved = await tx.gameAccount.updateMany({where: {id: item.accountId ?? '', status: 'available'}, data: {status: 'reserved', orderId, reservedAt: new Date()}});
      if (reserved.count !== 1) throw new StockError('This expired order can no longer be filled: the account was sold to another customer or taken off sale. Cancel the order and refund this payment.');
      continue;
    }
    const reserved = await tx.package.updateMany({where: {id: item.packageId, stockOnHand: {gte: item.quantity}}, data: {stockOnHand: {decrement: item.quantity}}});
    if (reserved.count !== 1) throw new StockError('This expired order can no longer be filled: an item is out of stock. Cancel it and refund the customer, or add stock first.');
  }
  await tx.order.update({where: {id: orderId}, data: {cancelledAt: null, cancelReason: null}});
}
