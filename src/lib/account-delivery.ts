import 'server-only';
import type {Prisma} from '@prisma/client';

type Tx = Prisma.TransactionClient;

export class DeliveryError extends Error {}

/**
 * Hands over the game accounts of a paid order: the sealed login is copied onto the order line (so the order keeps it even
 * if the account is edited or deleted later) and the account becomes sold. Runs inside the payment transaction, so a
 * payment is never recorded without its accounts. Returns how many were delivered.
 */
export async function deliverAccounts(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({where: {orderId, kind: 'account', deliveredAt: null}, select: {id: true, accountId: true}});
  const now = new Date();
  for (const item of items) {
    const account = item.accountId ? await tx.gameAccount.findUnique({where: {id: item.accountId}, select: {status: true, orderId: true, secretEnc: true}}) : null;
    if (!account || account.status !== 'reserved' || account.orderId !== orderId) throw new DeliveryError('An account in this order is no longer reserved for it, so it cannot be delivered. Check the account and refund the payment if it was sold on.');
    await tx.orderItem.update({where: {id: item.id}, data: {deliveredSecretEnc: account.secretEnc, deliveredAt: now}});
    await tx.gameAccount.update({where: {id: item.accountId!}, data: {status: 'sold', soldAt: now}});
  }
  return items.length;
}

/** An order of game accounts only has nothing left to do once they are delivered: it completes in the same transaction (the caller refreshes the trade counter after the commit). */
export async function completeAccountOrder(tx: Tx, orderId: string, actor: string) {
  await tx.order.update({where: {id: orderId}, data: {status: 'completed', completedAt: new Date(), deliveryNote: 'Account login details are on your order page.'}});
  await tx.orderEvent.create({data: {orderId, actor, action: 'completed', note: 'Account delivered automatically'}});
}
