import 'server-only';
import type {Role} from './admin-session';
import {getPaymentDb} from './payment-db';
import {publishChat} from './chat-events';

export const MAX_CHAT_IMAGE_BYTES = 1024 * 1024;
export const MAX_CHAT_IMAGES_PER_ROOM = 30;

export type ChatMessage = {id: string; room: string; author: string; role: Role; body: string; createdAt: string; clientMessageId?: string | null; image?: {url: string; name: string} | null; imageExpired?: boolean};

export const roomFor = (customerId: string) => `user:${customerId}`;
export const customerIdFromRoom = (room: string) => /^user:[a-z0-9]{10,40}$/.test(room) ? room.slice(5) : null;

type Row = {id: string; clientMessageId: string | null; customerId: string; authorRole: string; authorName: string; body: string; imageId: string | null; createdAt: Date; image: {name: string} | null};
function toMessage(row: Row): ChatMessage {
  return {
    id: row.id, clientMessageId: row.clientMessageId, room: roomFor(row.customerId), author: row.authorName, role: row.authorRole === 'admin' ? 'admin' : 'user', body: row.body, createdAt: row.createdAt.toISOString(),
    ...(row.image && row.imageId ? {image: {url: `/api/chat/images/${row.imageId}`, name: row.image.name}} : {}),
    ...(!row.imageId && row.body === '' ? {imageExpired: true} : {})
  };
}

const messageSelect = {id: true, clientMessageId: true, customerId: true, authorRole: true, authorName: true, body: true, imageId: true, createdAt: true, image: {select: {name: true}}} as const;

/** Stable pagination, including messages sharing the same timestamp. */
export async function messagePage(customerId: string, after?: string | null, before?: string | null) {
  const db = getPaymentDb();
  const cursorId = after || before;
  const cursor = cursorId ? await db.chatMessage.findFirst({where: {id: cursorId, customerId}, select: {id: true, createdAt: true}}) : null;
  const forward = Boolean(after && cursor);
  const direction = forward ? 'asc' : 'desc';
  const rows = await db.chatMessage.findMany({
    where: {customerId, ...(cursor ? {OR: forward
      ? [{createdAt: {gt: cursor.createdAt}}, {createdAt: cursor.createdAt, id: {gt: cursor.id}}]
      : [{createdAt: {lt: cursor.createdAt}}, {createdAt: cursor.createdAt, id: {lt: cursor.id}}]} : {})},
    orderBy: [{createdAt: direction}, {id: direction}], take: 61, select: messageSelect
  });
  const more = rows.length > 60;
  const page = rows.slice(0, 60);
  const messages = (forward ? page : page.reverse()).map(toMessage);
  return {messages, hasMore: forward && more, hasOlder: !forward && more, cursor: messages.at(-1)?.id ?? after ?? null, oldest: messages[0]?.id ?? null};
}

export async function listMessages(customerId: string) {
  return (await messagePage(customerId)).messages;
}

/** Same eligibility as the inbox, without loading every conversation and unread count. */
export async function validChatCustomer(customerId: string) {
  return Boolean(await getPaymentDb().customer.findFirst({where: {id: customerId,
    OR: [{chatMessages: {some: {}}}, {orders: {some: {status: {in: BOOKED_STATUSES}}}}]}, select: {id: true}}));
}

export async function messageForRequest(requestKey: string) {
  const row = await getPaymentDb().chatMessage.findUnique({where: {requestKey}, select: messageSelect});
  return row ? toMessage(row) : null;
}

// Paid orders waiting for (or booked for) delivery: their customers get a conversation even before they write.
const BOOKED_STATUSES = ['paid', 'scheduled'];

/** Conversations for the Admin inbox, most recent first. */
export async function listRooms() {
  const [unread, customers] = await Promise.all([adminUnreadByCustomer(), getPaymentDb().customer.findMany({
    where: {OR: [{chatMessages: {some: {}}}, {orders: {some: {status: {in: BOOKED_STATUSES}}}}]}, take: 200,
    select: {
      id: true, name: true, email: true,
      chatMessages: {orderBy: {createdAt: 'desc'}, take: 1, select: {body: true, imageId: true, authorRole: true, createdAt: true}},
      orders: {where: {status: {in: BOOKED_STATUSES}}, orderBy: {paidAt: 'desc'}, take: 1, select: {code: true, appointmentStart: true, paidAt: true}}
    }
  })]);
  return customers.map(customer => {
    const last = customer.chatMessages[0];
    const order = customer.orders[0];
    return {
      id: roomFor(customer.id), name: customer.name, email: customer.email, unread: unread.get(customer.id) ?? 0,
      lastMessage: last ? {body: last.imageId && !last.body ? '[Image]' : last.body, createdAt: last.createdAt.toISOString(), role: (last.authorRole === 'admin' ? 'admin' : 'user') as Role} : null,
      booking: order ? {code: order.code, appointmentStart: order.appointmentStart?.toISOString() ?? null} : null,
      sortAt: (last?.createdAt ?? order?.paidAt)?.toISOString() ?? ''
    };
  }).sort((a, b) => b.sortAt.localeCompare(a.sortAt)).map(({sortAt: _sortAt, ...room}) => room);
}

export async function roomImageCount(customerId: string) {
  return getPaymentDb().chatMessage.count({where: {customerId, imageId: {not: null}}});
}

export async function addMessage(input: {customerId: string; role: Role; authorName: string; body: string; requestKey?: string; clientMessageId?: string; image?: {bytes: Uint8Array<ArrayBuffer>; mimeType: string; name: string}}) {
  const db = getPaymentDb();
  let row: Row;
  try { row = await db.chatMessage.create({
    data: {
      requestKey: input.requestKey, clientMessageId: input.clientMessageId,
      customer: {connect: {id: input.customerId}}, authorRole: input.role === 'admin' ? 'admin' : 'customer', authorName: input.authorName.slice(0, 80), body: input.body,
      ...(input.image ? {image: {create: {data: input.image.bytes, mimeType: input.image.mimeType, name: input.image.name, sizeBytes: input.image.bytes.byteLength}}} : {})
    },
    select: messageSelect
  });
  } catch (error) {
    // Concurrent retries can race the first insert, including nested image creation.
    if (input.requestKey && (error as {code?: string}).code === 'P2002') {
      const existing = await messageForRequest(input.requestKey);
      if (existing) return existing;
    }
    throw error;
  }
  const message = toMessage(row);
  publishChat({room: message.room, kind: 'message', message});
  return message;
}

/** Opens the conversation after a payment, so the customer sees the Chat badge and the Admin can write first. */
export async function postPaymentMessage(order: {customerId: string; code: string; customerTimeZone: string | null; appointmentStart?: Date | null}) {
  const time = order.appointmentStart && new Intl.DateTimeFormat('en-GB', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: order.customerTimeZone ?? 'Asia/Ho_Chi_Minh'}).format(order.appointmentStart);
  const body = time
    ? `Payment received for order ${order.code}. Your appointment is booked for ${time}. We will talk with you here in this chat; feel free to message us anytime.`
    : `Payment received for order ${order.code}. We will pick a time inside the windows you chose and message you here in this chat.`;
  await addMessage({customerId: order.customerId, role: 'admin', authorName: 'Jewish Horse', body}).catch(error => console.error('Payment chat message failed', error instanceof Error ? error.message.split('\n')[0] : error));
}

/** Image bytes plus the owning conversation, for the access check in the image route. */
export async function chatImage(id: string) {
  return getPaymentDb().chatImage.findUnique({where: {id}, select: {data: true, mimeType: true, sizeBytes: true, message: {select: {customerId: true}}}});
}

// ---------- Read state (one mark per side: the customer, and the Admin team as a whole) ----------

/** Admin messages the customer has not seen yet. */
export async function customerUnreadCount(customerId: string) {
  const db = getPaymentDb();
  const customer = await db.customer.findUnique({where: {id: customerId}, select: {chatReadAt: true}});
  return db.chatMessage.count({where: {customerId, authorRole: 'admin', ...(customer?.chatReadAt ? {createdAt: {gt: customer.chatReadAt}} : {})}});
}

/** Marks replies up to `latest` as seen; writes only when something new arrived. */
export async function markCustomerRead(customerId: string, latest: Date) {
  await getPaymentDb().customer.updateMany({where: {id: customerId, OR: [{chatReadAt: null}, {chatReadAt: {lt: latest}}]}, data: {chatReadAt: latest}});
}

/** Unread customer messages per conversation for the Admin inbox. */
export async function adminUnreadByCustomer() {
  const rows = await getPaymentDb().$queryRaw<{customerId: string; unread: number}[]>`
    SELECT m."customerId" AS "customerId", COUNT(*)::int AS unread
    FROM "ChatMessage" m JOIN "Customer" c ON c.id = m."customerId"
    WHERE m."authorRole" = 'customer' AND (c."adminChatReadAt" IS NULL OR m."createdAt" > c."adminChatReadAt")
    GROUP BY m."customerId"`;
  return new Map(rows.map(row => [row.customerId, Number(row.unread)]));
}

export async function markAdminRead(customerId: string, latest: Date) {
  await getPaymentDb().customer.updateMany({where: {id: customerId, OR: [{adminChatReadAt: null}, {adminChatReadAt: {lt: latest}}]}, data: {adminChatReadAt: latest}});
}

/** Clients acknowledge only an opposite-side message that was actually rendered. */
export async function acknowledgeMessage(customerId: string, role: Role, id: string) {
  const row = await getPaymentDb().chatMessage.findFirst({where: {id, customerId, authorRole: role === 'admin' ? 'customer' : 'admin'}, select: {createdAt: true}});
  if (!row) return false;
  if (role === 'admin') await markAdminRead(customerId, row.createdAt);
  else await markCustomerRead(customerId, row.createdAt);
  publishChat({room: roomFor(customerId), kind: 'read'});
  return true;
}
