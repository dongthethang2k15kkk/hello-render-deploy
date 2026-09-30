import 'server-only';
import type {Prisma} from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Returns an order's items to stock (cancelled or expired orders). */
export async function restockItems(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({where: {orderId}, select: {packageId: true, quantity: true}});
  for (const item of items) await tx.package.updateMany({where: {id: item.packageId}, data: {stockOnHand: {increment: item.quantity}}});
}

export class StockError extends Error {}

/** Takes an expired order's items back out of stock when a late payment revives it; fails if stock ran out. */
export async function reReserveItems(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({where: {orderId}, select: {packageId: true, quantity: true}});
  for (const item of items) {
    const reserved = await tx.package.updateMany({where: {id: item.packageId, stockOnHand: {gte: item.quantity}}, data: {stockOnHand: {decrement: item.quantity}}});
    if (reserved.count !== 1) throw new StockError('This expired order can no longer be filled: an item is out of stock. Cancel it and refund the customer, or add stock first.');
  }
  await tx.order.update({where: {id: orderId}, data: {cancelledAt: null, cancelReason: null}});
}
