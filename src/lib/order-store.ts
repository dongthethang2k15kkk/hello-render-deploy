import 'server-only';
import type {Prisma} from '@prisma/client';
import {recordAudit} from './audit';
import {googleCalendarLink, icsEvent} from './calendar';
import {createCartSchema, type CartLine} from './cart';
import {getPublicCatalog} from './catalog-server';
import {dateRange} from './customer-rules';
import * as templates from './email-templates';
import {sendMail} from './mailer';
import {formatVnd} from './money';
import {notifyCustomer} from './notifications';
import {allAdminEmails} from './admin-team';
import {postPaymentMessage} from './chat-store';
import {appointmentProblem, generateOrderCode, HOLD_MINUTES, NEEDS_ACTION, nextStatus, REPORT_DELAY_SECONDS, slotProblem, validTimeZone, VN_TIME_ZONE, type OrderStatus} from './order-rules';
import {getPaymentDb} from './payment-db';
import {alertAppointment} from './payment-detection';
import {reReserveItems, restockItems, StockError} from './order-stock';
import {uniqueLitoshi} from './ltc';
import {formatLtc, parseLtc} from './ltc-format';
import {getLtcRate} from './ltc-rate';

export class OrderError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type Tx = Prisma.TransactionClient;
type BankSnapshot = {bankBin: string; bankName: string; accountNumber: string; accountHolder: string};
type WalletSnapshot = {network: 'LTC'; address: string; label: string};
export type PaymentMethod = 'bank' | 'ltc';
export type PaymentSnapshot = BankSnapshot | WalletSnapshot;
const txOptions = {maxWait: 10000, timeout: 20000};
const customerLink = (code: string) => `/en/orders/${code}`;

const restock = restockItems;

const expiryState = globalThis as unknown as {orderExpiryAt?: number};
/** Expires unpaid orders past their 30-minute hold and returns their stock. Render Free has no scheduler, so reads call this. */
export async function expireStaleOrders(throttleMs = 0) {
  if (!process.env.DATABASE_URL) return;
  if (throttleMs && expiryState.orderExpiryAt && Date.now() - expiryState.orderExpiryAt < throttleMs) return;
  expiryState.orderExpiryAt = Date.now();
  const db = getPaymentDb();
  const stale = await db.order.findMany({where: {status: 'awaiting_payment', holdExpiresAt: {lt: new Date()}}, select: {id: true, code: true, customerId: true}, take: 50});
  for (const order of stale) {
    const expired = await db.$transaction(async tx => {
      const changed = await tx.order.updateMany({where: {id: order.id, status: 'awaiting_payment'}, data: {status: 'expired', cancelledAt: new Date(), cancelReason: `Not paid within ${HOLD_MINUTES} minutes`}});
      if (changed.count !== 1) return false;
      await restock(tx, order.id);
      await tx.orderEvent.create({data: {orderId: order.id, actor: 'system', action: 'expired', note: `Not reported as paid within ${HOLD_MINUTES} minutes; items returned to stock`}});
      return true;
    }, txOptions);
    if (expired) await notifyCustomer({customerId: order.customerId, orderId: order.id, title: `Order ${order.code} expired`, body: `The ${HOLD_MINUTES}-minute payment window ended, so the items were released. You can place a new order at any time.`, link: customerLink(order.code)}).catch(() => undefined);
  }
}

// ---------- Customer side ----------

export async function createOrder(customer: {id: string}, lines: CartLine[], method: PaymentMethod = 'bank') {
  if (!lines.length) throw new OrderError('Your cart is empty.');
  await expireStaleOrders();
  const catalog = await getPublicCatalog();
  if (catalog.source !== 'database') throw new OrderError('The shop is temporarily unavailable. Please try again in a moment.', 503);
  const parsed = createCartSchema(catalog.products).safeParse(lines);
  if (!parsed.success) throw new OrderError('Your cart changed: an item is no longer available or exceeds the stock. Please review your cart.', 409);
  const items = parsed.data.map(line => {
    const product = catalog.products.find(item => item.id === line.productId)!;
    return {packageId: product.id, productSlug: product.slug, sku: product.sku, title: product.title.en, unitPriceVnd: product.priceVnd, quantity: line.quantity, delivery: line.delivery};
  });
  const totalVnd = items.reduce((sum, item) => sum + item.unitPriceVnd * item.quantity, 0);
  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.packageId, (quantities.get(item.packageId) ?? 0) + item.quantity);
  // The Litecoin price is locked when the order is placed and holds for the 30-minute payment window.
  const ltcRate = method === 'ltc' ? await getLtcRate() : null;
  if (method === 'ltc' && !ltcRate) throw new OrderError('Litecoin payments are temporarily unavailable. Choose bank transfer or try again shortly.', 503);

  return getPaymentDb().$transaction(async tx => {
    const bank = method === 'bank' ? await tx.bankAccount.findFirst({where: {active: true}, orderBy: [{lastAssigned: 'asc'}, {id: 'asc'}]}) : null;
    const wallet = method === 'ltc' ? await tx.cryptoWallet.findFirst({where: {active: true, network: 'LTC'}, orderBy: [{lastAssigned: 'asc'}, {id: 'asc'}]}) : null;
    if (!bank && !wallet) throw new OrderError(method === 'ltc' ? 'Litecoin payments are not set up yet. Choose bank transfer or contact the shop on Discord.' : 'Payments are not set up yet. Please contact the shop on Discord.', 503);
    // Reserve stock atomically; a concurrent order that took the last unit makes this fail cleanly.
    for (const [packageId, quantity] of quantities) {
      const reserved = await tx.package.updateMany({where: {id: packageId, active: true, stockOnHand: {gte: quantity}}, data: {stockOnHand: {decrement: quantity}}});
      if (reserved.count !== 1) throw new OrderError('Sorry, an item just sold out. Please review your cart.', 409);
    }
    let code = generateOrderCode();
    while (await tx.order.findUnique({where: {code}, select: {id: true}})) code = generateOrderCode();
    let snapshot: PaymentSnapshot;
    let cryptoAmount: string | null = null;
    if (bank) {
      await tx.bankAccount.update({where: {id: bank.id}, data: {lastAssigned: new Date()}});
      snapshot = {bankBin: bank.bankBin, bankName: bank.bankName, accountNumber: bank.accountNumber, accountHolder: bank.accountHolder};
    } else {
      await tx.cryptoWallet.update({where: {id: wallet!.id}, data: {lastAssigned: new Date()}});
      // Crypto transfers carry no note, so each open order on an address gets a distinct amount.
      const open = await tx.order.findMany({where: {paymentMethod: 'ltc', status: {in: ['awaiting_payment', 'payment_reported']}, cryptoAmount: {not: null}}, select: {cryptoAmount: true, bankSnapshot: true}});
      const taken = new Set(open.filter(item => (item.bankSnapshot as WalletSnapshot).address === wallet!.address).map(item => parseLtc(item.cryptoAmount!)).filter((value): value is bigint => value !== null));
      cryptoAmount = formatLtc(uniqueLitoshi(totalVnd, ltcRate!.vndPerLtc, taken));
      snapshot = {network: 'LTC', address: wallet!.address, label: wallet!.label};
    }
    return tx.order.create({data: {
      code, customerId: customer.id, status: 'awaiting_payment', totalVnd, vndPerUsd: catalog.vndPerUsd, bankSnapshot: snapshot,
      paymentMethod: method, cryptoAmount, cryptoRateVnd: ltcRate?.vndPerLtc ?? null,
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
      items: {create: items}, events: {create: {actor: 'customer', action: 'created', note: `Order placed · ${formatVnd(totalVnd)}${cryptoAmount ? ` · pay ${cryptoAmount} LTC` : ''}`}}
    }, select: {id: true, code: true}});
  }, txOptions);
}

const customerOrderInclude = {
  items: {select: {title: true, sku: true, unitPriceVnd: true, quantity: true, delivery: true}},
  slots: {orderBy: {startsAt: 'asc'}, select: {startsAt: true, endsAt: true}},
  events: {where: {action: {not: 'note'}}, orderBy: {createdAt: 'asc'}, select: {action: true, note: true, createdAt: true}}
} satisfies Prisma.OrderInclude;

/** Expires this order immediately when its hold has passed, so the page never shows a stale "awaiting payment". */
async function expireIfDue(order: {status: string; holdExpiresAt: Date}) {
  if (order.status !== 'awaiting_payment' || order.holdExpiresAt.getTime() > Date.now()) return false;
  await expireStaleOrders();
  return true;
}

export async function customerOrder(customerId: string, code: string) {
  await expireStaleOrders(60_000);
  let order = await getPaymentDb().order.findFirst({where: {code, customerId}, include: customerOrderInclude});
  if (order && await expireIfDue(order)) order = await getPaymentDb().order.findFirst({where: {code, customerId}, include: customerOrderInclude});
  if (!order) return null;
  // Internal Admin notes and the paying Admin's identity are never shown to customers.
  const {internalNote: _internal, paymentConfirmedBy: _confirmedBy, assignedAdmin: _assigned, customerId: _customer, ...visible} = order;
  return {...visible, paymentMethod: order.paymentMethod as PaymentMethod, bankSnapshot: order.bankSnapshot as PaymentSnapshot};
}

export async function customerOrders(customerId: string) {
  await expireStaleOrders(60_000);
  return getPaymentDb().order.findMany({where: {customerId}, orderBy: {createdAt: 'desc'}, take: 100, select: {code: true, status: true, totalVnd: true, vndPerUsd: true, createdAt: true, appointmentStart: true, appointmentEnd: true, customerTimeZone: true, items: {select: {title: true, quantity: true}}}});
}

export async function reportTransfer(customer: {id: string; name: string; email: string}, code: string, input: {timeZone: string; slots: {start: string; end: string}[]; txid?: string; asap?: boolean}, origin: string) {
  const db = getPaymentDb();
  const order = await db.order.findFirst({where: {code, customerId: customer.id}, include: {items: true}});
  if (!order) throw new OrderError('Order not found.', 404);
  if (order.status === 'awaiting_payment' && order.holdExpiresAt.getTime() < Date.now()) {
    await expireStaleOrders();
    throw new OrderError(`The ${HOLD_MINUTES}-minute payment window has ended. Please place a new order; if you already transferred, message us in Chat.`, 410);
  }
  if (!nextStatus(order.status, 'report')) throw new OrderError('This order is not waiting for payment.', 409);
  // A few seconds of slack for clock differences; the page itself waits the full delay.
  if (Date.now() - order.createdAt.getTime() < (REPORT_DELAY_SECONDS - 5) * 1000) throw new OrderError('Please make the payment first. You can confirm it about a minute after placing the order.', 409);
  const problem = slotProblem(input.slots);
  if (problem) throw new OrderError(problem);
  const timeZone = validTimeZone(input.timeZone) ? input.timeZone : VN_TIME_ZONE;
  const slots = input.slots.map(slot => ({startsAt: new Date(slot.start), endsAt: new Date(slot.end)})).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  await db.$transaction(async tx => {
    const changed = await tx.order.updateMany({where: {id: order.id, status: 'awaiting_payment'}, data: {status: 'payment_reported', reportedAt: new Date(), customerTimeZone: timeZone, asap: Boolean(input.asap), ...(input.txid ? {customerTxid: input.txid.toLowerCase()} : {})}});
    if (changed.count !== 1) throw new OrderError('This order is not waiting for payment.', 409);
    await tx.orderSlot.createMany({data: slots.map(slot => ({orderId: order.id, ...slot}))});
    await tx.orderEvent.create({data: {orderId: order.id, actor: 'customer', action: 'payment_reported', note: `${slots.length} available time${slots.length === 1 ? '' : 's'} proposed`}});
  }, txOptions);
  await notifyCustomer({customerId: customer.id, orderId: order.id, title: `We are checking your payment · ${order.code}`, body: 'Thanks! We will confirm your transfer and book one of the times you chose. You will get an email and a message here.', link: customerLink(order.code)});
  const mail = templates.adminPaymentReported({code: order.code, customerName: customer.name, customerEmail: customer.email, totalVnd: order.totalVnd, crypto: order.paymentMethod === 'ltc' ? {amount: order.cryptoAmount ?? '', address: (order.bankSnapshot as WalletSnapshot).address, txid: input.txid ?? null} : null, items: order.items.map(item => `${item.title} × ${item.quantity}`), slots: slots.map(slot => ({start: slot.startsAt, end: slot.endsAt})), orderUrl: `${origin}/en/admin/orders/${order.id}`});
  await sendMail({to: await allAdminEmails(), ...mail, kind: 'admin.payment_reported', orderId: order.id});
}

export async function updateTimes(customerId: string, code: string, input: {timeZone: string; slots: {start: string; end: string}[]; asap?: boolean}, origin = '') {
  const db = getPaymentDb();
  const order = await db.order.findFirst({where: {code, customerId}, select: {id: true, code: true, status: true, asap: true, customer: {select: {name: true}}, _count: {select: {slots: true}}}});
  if (!order) throw new OrderError('Order not found.', 404);
  if (order.status !== 'payment_reported' && order.status !== 'paid') throw new OrderError('Times can only be changed before the appointment is booked. Message us in Chat.', 409);
  const problem = slotProblem(input.slots);
  if (problem) throw new OrderError(problem);
  await db.$transaction(async tx => {
    await tx.orderSlot.deleteMany({where: {orderId: order.id}});
    await tx.orderSlot.createMany({data: input.slots.map(slot => ({orderId: order.id, startsAt: new Date(slot.start), endsAt: new Date(slot.end)}))});
    await tx.order.update({where: {id: order.id}, data: {customerTimeZone: validTimeZone(input.timeZone) ? input.timeZone : VN_TIME_ZONE, asap: Boolean(input.asap)}});
    await tx.orderEvent.create({data: {orderId: order.id, actor: 'customer', action: 'times_updated', note: input.asap ? 'Free right now' : `${input.slots.length} available time${input.slots.length === 1 ? '' : 's'}`}});
  }, txOptions);
  // After an automatic payment the Admins have not seen any times yet, so tell them when the customer picks some.
  if (order.status === 'paid' && (order._count.slots === 0 || (input.asap && !order.asap)) && origin) {
    await sendMail({to: await allAdminEmails(), ...templates.adminTimesAdded({code: order.code, customerName: order.customer.name, slots: input.slots, asap: Boolean(input.asap), orderUrl: `${origin}/en/admin/orders/${order.id}`}), kind: 'admin.times_added', orderId: order.id});
  }
}

export async function cancelByCustomer(customerId: string, code: string) {
  const db = getPaymentDb();
  const order = await db.order.findFirst({where: {code, customerId}, select: {id: true, status: true}});
  if (!order) throw new OrderError('Order not found.', 404);
  if (!nextStatus(order.status, 'cancel-customer')) throw new OrderError('This order can no longer be cancelled online. Message us in Chat.', 409);
  await db.$transaction(async tx => {
    const changed = await tx.order.updateMany({where: {id: order.id, status: 'awaiting_payment'}, data: {status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Cancelled by customer'}});
    if (changed.count !== 1) throw new OrderError('This order can no longer be cancelled online.', 409);
    await restock(tx, order.id);
    await tx.orderEvent.create({data: {orderId: order.id, actor: 'customer', action: 'cancelled', note: 'Cancelled before payment; items returned to stock'}});
  }, txOptions);
}

// ---------- Admin side ----------

export type AdminOrderFilters = {q: string; status: string; from?: string; to?: string; page: number};

export async function listOrders(filters: AdminOrderFilters, pageSize = 50) {
  await expireStaleOrders(60_000);
  const status = filters.status === 'needs-action' ? {status: {in: NEEDS_ACTION}} : filters.status !== 'all' ? {status: filters.status} : {};
  const q = filters.q.trim();
  const where: Prisma.OrderWhereInput = {
    ...status,
    ...(q ? {OR: [{code: {contains: q.toUpperCase()}}, {customer: {email: {contains: q, mode: 'insensitive'}}}, {customer: {name: {contains: q, mode: 'insensitive'}}}]} : {}),
    ...(dateRange(filters.from, filters.to) ? {createdAt: dateRange(filters.from, filters.to)} : {})
  };
  const db = getPaymentDb();
  const [total, orders, needsAction] = await Promise.all([
    db.order.count({where}),
    db.order.findMany({where, orderBy: {createdAt: 'desc'}, skip: (filters.page - 1) * pageSize, take: pageSize, select: {
      id: true, code: true, status: true, totalVnd: true, createdAt: true, reportedAt: true, appointmentStart: true, assignedAdmin: true,
      customer: {select: {id: true, name: true, email: true}}, items: {select: {title: true, quantity: true}}
    }}),
    db.order.count({where: {status: {in: NEEDS_ACTION}}})
  ]);
  return {total, page: filters.page, pageSize, orders, needsAction};
}

export async function adminOrder(id: string) {
  await expireStaleOrders(60_000);
  const db = getPaymentDb();
  const include = {customer: {select: {id: true, name: true, email: true, status: true}}, items: true, slots: {orderBy: {startsAt: 'asc'}}, events: {orderBy: {createdAt: 'asc'}}} satisfies Prisma.OrderInclude;
  let order = await db.order.findUnique({where: {id}, include});
  if (order && await expireIfDue(order)) order = await db.order.findUnique({where: {id}, include});
  if (!order) return null;
  const emails = await db.emailLog.findMany({where: {orderId: id}, orderBy: {createdAt: 'desc'}, take: 20, select: {id: true, recipient: true, subject: true, kind: true, status: true, error: true, createdAt: true}});
  return {...order, paymentMethod: order.paymentMethod as PaymentMethod, bankSnapshot: order.bankSnapshot as PaymentSnapshot, emails};
}

export async function needsActionCount() {
  if (!process.env.DATABASE_URL) return 0;
  try { return await getPaymentDb().order.count({where: {status: {in: NEEDS_ACTION}}}); } catch { return 0; }
}

async function loadForAdmin(id: string) {
  const order = await getPaymentDb().order.findUnique({where: {id}, include: {customer: {select: {id: true, name: true, email: true}}}});
  if (!order) throw new OrderError('Order not found.', 404);
  return order;
}

async function sendAppointment(order: {id: string; code: string; customerTimeZone: string | null; customer: {name: string; email: string}}, start: Date, end: Date, adminEmail: string, origin: string, rescheduled: boolean) {
  const customerUrl = `${origin}${customerLink(order.code)}`;
  const title = `Jewish Horse · order ${order.code}`;
  const calendar = {uid: `${order.id}@jewish-horse`, start, end, title, description: 'Open the Jewish Horse website and go to Chat at this time.', url: customerUrl};
  const ics = [{filename: 'appointment.ics', contentType: 'text/calendar; charset=UTF-8; method=PUBLISH', content: icsEvent(calendar)}];
  const customerMail = templates.customerAppointment({code: order.code, name: order.customer.name, start, end, timeZone: order.customerTimeZone ?? VN_TIME_ZONE, orderUrl: customerUrl, calendarUrl: googleCalendarLink(calendar), rescheduled});
  const adminUrl = `${origin}/en/admin/orders/${order.id}`;
  const adminCalendar = {...calendar, uid: `${order.id}-admin@jewish-horse`, title: `Hẹn khách ${order.customer.name} · ${order.code}`, description: 'Mở chat của khách trong trang đơn.', url: adminUrl};
  const adminMail = templates.adminAppointmentAssigned({code: order.code, customerName: order.customer.name, start, end, orderUrl: adminUrl, calendarUrl: googleCalendarLink(adminCalendar)});
  await Promise.all([
    sendMail({to: [order.customer.email], ...customerMail, attachments: ics, kind: rescheduled ? 'customer.rescheduled' : 'customer.appointment', orderId: order.id}),
    sendMail({to: [adminEmail], ...adminMail, attachments: [{...ics[0], content: icsEvent(adminCalendar)}], kind: 'admin.appointment', orderId: order.id})
  ]);
  // A new or changed time resets the reminder. An appointment starting within 20 minutes is announced in Chat and
  // Inbox right away (the appointment email above already went out).
  await getPaymentDb().order.update({where: {id: order.id}, data: {reminderSentAt: null}});
  const lead = start.getTime() - Date.now();
  if (lead <= 20 * 60_000) await alertAppointment(order.id, origin, lead <= 2 * 60_000, {email: false});
}

/** Confirms the transfer and, optionally in the same step, books the appointment. */
export async function confirmPayment(adminEmail: string, id: string, input: {amountVnd: number; reference: string; appointment?: {start: Date; end: Date}}, origin: string) {
  const order = await loadForAdmin(id);
  if (!nextStatus(order.status, 'confirm-payment')) throw new OrderError('This order is not waiting for payment confirmation.', 409);
  if (!Number.isInteger(input.amountVnd) || input.amountVnd <= 0) throw new OrderError('Enter the amount you received in VND.');
  if (input.appointment) {
    const problem = appointmentProblem(input.appointment.start.getTime(), input.appointment.end.getTime());
    if (problem) throw new OrderError(problem);
  }
  const status: OrderStatus = input.appointment ? 'scheduled' : 'paid';
  await getPaymentDb().$transaction(async tx => {
    // A late transfer revives the order only if its items can be reserved again.
    if (order.status === 'expired') await reReserveItems(tx, id).catch(error => { throw error instanceof StockError ? new OrderError(error.message, 409) : error; });
    const changed = await tx.order.updateMany({where: {id, status: order.status}, data: {
      status, paidAt: new Date(), paidAmountVnd: input.amountVnd, paymentReference: input.reference || null, paymentConfirmedBy: adminEmail, assignedAdmin: adminEmail,
      ...(input.appointment ? {appointmentStart: input.appointment.start, appointmentEnd: input.appointment.end} : {})
    }});
    if (changed.count !== 1) throw new OrderError('The order changed meanwhile. Reload and try again.', 409);
    await tx.orderEvent.create({data: {orderId: id, actor: adminEmail, action: 'payment_confirmed', note: `Received ${formatVnd(input.amountVnd)}${input.amountVnd !== order.totalVnd ? ` (order total ${formatVnd(order.totalVnd)})` : ''}`}});
    if (input.appointment) await tx.orderEvent.create({data: {orderId: id, actor: adminEmail, action: 'scheduled', note: 'Appointment booked'}});
  }, txOptions);
  await recordAudit({actorEmail: adminEmail, action: 'order.payment_confirmed', summary: `Confirmed ${formatVnd(input.amountVnd)} for ${order.code}${input.appointment ? ' and booked the appointment' : ''}`, entityType: 'order', entityId: id, customerId: order.customerId});
  await postPaymentMessage({customerId: order.customerId, code: order.code, customerTimeZone: order.customerTimeZone, appointmentStart: input.appointment?.start});
  if (input.appointment) {
    await notifyCustomer({customerId: order.customerId, orderId: id, title: `Appointment booked · ${order.code}`, body: 'Your payment is confirmed and your appointment is booked. Open the order for the time and calendar links.', link: customerLink(order.code)});
    await sendAppointment(order, input.appointment.start, input.appointment.end, adminEmail, origin, false);
  } else {
    await notifyCustomer({customerId: order.customerId, orderId: id, title: `Payment received · ${order.code}`, body: 'We received your payment and will confirm one of your times shortly.', link: customerLink(order.code)});
    await sendMail({to: [order.customer.email], ...templates.customerPaymentConfirmed({code: order.code, name: order.customer.name, orderUrl: `${origin}${customerLink(order.code)}`}), kind: 'customer.payment_confirmed', orderId: id});
  }
}

export async function scheduleAppointment(adminEmail: string, id: string, appointment: {start: Date; end: Date}, origin: string) {
  const order = await loadForAdmin(id);
  if (!nextStatus(order.status, 'schedule')) throw new OrderError('Confirm the payment before booking a time.', 409);
  const problem = appointmentProblem(appointment.start.getTime(), appointment.end.getTime());
  if (problem) throw new OrderError(problem);
  const rescheduled = order.status === 'scheduled';
  await getPaymentDb().$transaction(async tx => {
    await tx.order.update({where: {id}, data: {status: 'scheduled', appointmentStart: appointment.start, appointmentEnd: appointment.end, assignedAdmin: adminEmail}});
    await tx.orderEvent.create({data: {orderId: id, actor: adminEmail, action: rescheduled ? 'rescheduled' : 'scheduled', note: rescheduled ? 'Appointment time changed' : 'Appointment booked'}});
  }, txOptions);
  await recordAudit({actorEmail: adminEmail, action: rescheduled ? 'order.rescheduled' : 'order.scheduled', summary: `${rescheduled ? 'Changed' : 'Booked'} the appointment for ${order.code}`, entityType: 'order', entityId: id, customerId: order.customerId});
  await notifyCustomer({customerId: order.customerId, orderId: id, title: `${rescheduled ? 'Appointment changed' : 'Appointment booked'} · ${order.code}`, body: 'Open the order to see the time and add it to your calendar.', link: customerLink(order.code)});
  await sendAppointment(order, appointment.start, appointment.end, adminEmail, origin, rescheduled);
}

export async function completeOrder(adminEmail: string, id: string, deliveryNote: string, origin: string) {
  const order = await loadForAdmin(id);
  if (!nextStatus(order.status, 'complete')) throw new OrderError('Only paid or scheduled orders can be completed.', 409);
  const note = deliveryNote.trim();
  if (!note) throw new OrderError('Write the delivery details the customer should see.');
  await getPaymentDb().$transaction(async tx => {
    await tx.order.update({where: {id}, data: {status: 'completed', completedAt: new Date(), deliveryNote: note.slice(0, 5000), assignedAdmin: order.assignedAdmin ?? adminEmail}});
    await tx.orderEvent.create({data: {orderId: id, actor: adminEmail, action: 'completed', note: 'Delivered'}});
  }, txOptions);
  await recordAudit({actorEmail: adminEmail, action: 'order.completed', summary: `Completed ${order.code}`, entityType: 'order', entityId: id, customerId: order.customerId});
  await notifyCustomer({customerId: order.customerId, orderId: id, title: `Order complete · ${order.code}`, body: 'Your order has been delivered. Open it to see the delivery details.', link: customerLink(order.code)});
  await sendMail({to: [order.customer.email], ...templates.customerCompleted({code: order.code, name: order.customer.name, orderUrl: `${origin}${customerLink(order.code)}`}), kind: 'customer.completed', orderId: id});
}

export async function cancelByAdmin(adminEmail: string, id: string, reason: string, origin: string) {
  const order = await loadForAdmin(id);
  if (!nextStatus(order.status, 'cancel-admin')) throw new OrderError('This order can no longer be cancelled.', 409);
  const paid = order.paidAt !== null || order.status === 'payment_reported';
  await getPaymentDb().$transaction(async tx => {
    const changed = await tx.order.updateMany({where: {id, status: order.status}, data: {status: 'cancelled', cancelledAt: new Date(), cancelReason: reason.trim().slice(0, 500) || 'Cancelled by the shop'}});
    if (changed.count !== 1) throw new OrderError('The order changed meanwhile. Reload and try again.', 409);
    await restock(tx, id);
    await tx.orderEvent.create({data: {orderId: id, actor: adminEmail, action: 'cancelled', note: reason.trim() || 'Cancelled by the shop'}});
  }, txOptions);
  await recordAudit({actorEmail: adminEmail, action: 'order.cancelled', summary: `Cancelled ${order.code}${reason.trim() ? `: ${reason.trim()}` : ''}`, entityType: 'order', entityId: id, customerId: order.customerId});
  await notifyCustomer({customerId: order.customerId, orderId: id, title: `Order cancelled · ${order.code}`, body: paid ? 'Your order was cancelled. If you transferred money, we will contact you in Chat about the refund.' : 'Your order was cancelled.', link: customerLink(order.code)});
  await sendMail({to: [order.customer.email], ...templates.customerCancelled({code: order.code, name: order.customer.name, reason: reason.trim(), paid, orderUrl: `${origin}${customerLink(order.code)}`}), kind: 'customer.cancelled', orderId: id});
}

export async function addInternalNote(adminEmail: string, id: string, note: string) {
  const text = note.trim().slice(0, 2000);
  if (!text) throw new OrderError('Write a note first.');
  const order = await loadForAdmin(id);
  await getPaymentDb().orderEvent.create({data: {orderId: id, actor: adminEmail, action: 'note', note: text}});
  await recordAudit({actorEmail: adminEmail, action: 'order.note', summary: `Added an internal note to ${order.code}`, entityType: 'order', entityId: id, customerId: order.customerId});
}

export async function resendEmail(adminEmail: string, id: string, kind: 'admin.payment_reported' | 'customer.appointment' | 'customer.completed', origin: string) {
  const order = await getPaymentDb().order.findUnique({where: {id}, include: {customer: {select: {name: true, email: true}}, items: true, slots: {orderBy: {startsAt: 'asc'}}}});
  if (!order) throw new OrderError('Order not found.', 404);
  if (kind === 'admin.payment_reported') {
    const mail = templates.adminPaymentReported({code: order.code, customerName: order.customer.name, customerEmail: order.customer.email, totalVnd: order.totalVnd, crypto: order.paymentMethod === 'ltc' ? {amount: order.cryptoAmount ?? '', address: (order.bankSnapshot as WalletSnapshot).address, txid: order.customerTxid} : null, items: order.items.map(item => `${item.title} × ${item.quantity}`), slots: order.slots.map(slot => ({start: slot.startsAt, end: slot.endsAt})), orderUrl: `${origin}/en/admin/orders/${order.id}`});
    await sendMail({to: await allAdminEmails(), ...mail, kind, orderId: id});
  } else if (kind === 'customer.appointment') {
    if (!order.appointmentStart || !order.appointmentEnd) throw new OrderError('This order has no appointment yet.', 409);
    await sendAppointment(order, order.appointmentStart, order.appointmentEnd, order.assignedAdmin ?? adminEmail, origin, false);
  } else {
    if (order.status !== 'completed') throw new OrderError('This order is not completed.', 409);
    await sendMail({to: [order.customer.email], ...templates.customerCompleted({code: order.code, name: order.customer.name, orderUrl: `${origin}${customerLink(order.code)}`}), kind, orderId: id});
  }
  await recordAudit({actorEmail: adminEmail, action: 'order.email_resent', summary: `Resent ${kind} email for ${order.code}`, entityType: 'order', entityId: id});
}

// ---------- Overview ----------

/** Midnight in Vietnam time (UTC+7) `daysAgo` days back, as a UTC Date. */
function vietnamDayStart(daysAgo = 0) {
  const now = new Date(Date.now() + 7 * 60 * 60_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo) - 7 * 60 * 60_000);
}

export async function overview() {
  await expireStaleOrders(60_000);
  const db = getPaymentDb();
  const revenue = async (since: Date) => {
    const result = await db.order.aggregate({where: {paidAt: {gte: since}, status: {notIn: ['cancelled', 'expired']}}, _sum: {paidAmountVnd: true}, _count: true});
    return {vnd: result._sum.paidAmountVnd ?? 0, orders: result._count};
  };
  const [paymentReported, paid, awaitingPayment, upcoming, today, week, month, customers, newCustomers, lowStock, size, emailFailures] = await Promise.all([
    db.order.count({where: {status: 'payment_reported'}}),
    db.order.count({where: {status: 'paid'}}),
    db.order.count({where: {status: 'awaiting_payment'}}),
    db.order.findMany({where: {status: 'scheduled', appointmentEnd: {gte: new Date()}}, orderBy: {appointmentStart: 'asc'}, take: 10, select: {id: true, code: true, appointmentStart: true, appointmentEnd: true, assignedAdmin: true, customer: {select: {name: true}}}}),
    revenue(vietnamDayStart(0)), revenue(vietnamDayStart(6)), revenue(vietnamDayStart(29)),
    db.customer.count({where: {status: 'active'}}),
    db.customer.count({where: {createdAt: {gte: vietnamDayStart(6)}}}),
    db.package.findMany({where: {active: true, stockOnHand: {lte: 3}, product: {active: true}}, orderBy: {stockOnHand: 'asc'}, take: 10, select: {id: true, sku: true, stockOnHand: true, product: {select: {slug: true, translations: {where: {locale: 'en'}, select: {title: true}}}}}}),
    db.$queryRaw<{size: bigint}[]>`SELECT pg_database_size(current_database()) AS size`,
    db.emailLog.count({where: {status: 'failed', createdAt: {gte: vietnamDayStart(6)}}})
  ]);
  return {
    needsAction: {paymentReported, paid, awaitingPayment}, upcoming,
    revenue: {today, week, month},
    customers: {active: customers, newThisWeek: newCustomers},
    lowStock: lowStock.map(item => ({id: item.id, sku: item.sku, stock: item.stockOnHand, title: item.product.translations[0]?.title ?? item.product.slug})),
    databaseBytes: Number(size[0]?.size ?? 0), emailFailures
  };
}
