import 'server-only';
import {getPaymentDb} from './payment-db';

/** Customer Inbox entry; every order update creates one so nothing depends on email delivery. */
export async function notifyCustomer(input: {customerId: string; orderId?: string; title: string; body: string; link: string}) {
  await getPaymentDb().notification.create({data: {customerId: input.customerId, orderId: input.orderId ?? null, title: input.title.slice(0, 200), body: input.body.slice(0, 1000), link: input.link}});
}

export async function unreadCount(customerId: string) {
  return getPaymentDb().notification.count({where: {customerId, readAt: null}});
}

export async function listNotifications(customerId: string, take = 50) {
  return getPaymentDb().notification.findMany({where: {customerId}, orderBy: {createdAt: 'desc'}, take, select: {id: true, title: true, body: true, link: true, readAt: true, createdAt: true}});
}

export async function markRead(customerId: string, ids?: string[]) {
  await getPaymentDb().notification.updateMany({where: {customerId, readAt: null, ...(ids ? {id: {in: ids}} : {})}, data: {readAt: new Date()}});
}
