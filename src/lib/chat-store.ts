import 'server-only';
import type {Role} from './admin-session';
import {getPaymentDb} from './payment-db';

export const MAX_CHAT_IMAGE_BYTES = 1024 * 1024;
export const MAX_CHAT_IMAGES_PER_ROOM = 30;

export type ChatMessage = {id: string; room: string; author: string; role: Role; body: string; createdAt: string; image?: {url: string; name: string} | null; imageExpired?: boolean};

export const roomFor = (customerId: string) => `user:${customerId}`;
export const customerIdFromRoom = (room: string) => /^user:[a-z0-9]{10,40}$/.test(room) ? room.slice(5) : null;

type Row = {id: string; customerId: string; authorRole: string; authorName: string; body: string; imageId: string | null; createdAt: Date; image: {name: string} | null};
function toMessage(row: Row): ChatMessage {
  return {
    id: row.id, room: roomFor(row.customerId), author: row.authorName, role: row.authorRole === 'admin' ? 'admin' : 'user', body: row.body, createdAt: row.createdAt.toISOString(),
    ...(row.image && row.imageId ? {image: {url: `/api/chat/images/${row.imageId}`, name: row.image.name}} : {}),
    ...(!row.imageId && row.body === '' ? {imageExpired: true} : {})
  };
}

const messageSelect = {id: true, customerId: true, authorRole: true, authorName: true, body: true, imageId: true, createdAt: true, image: {select: {name: true}}} as const;

/** Latest 200 messages of one conversation, oldest first. */
export async function listMessages(customerId: string) {
  const rows = await getPaymentDb().chatMessage.findMany({where: {customerId}, orderBy: {createdAt: 'desc'}, take: 200, select: messageSelect});
  return rows.reverse().map(toMessage);
}

/** Conversations for the Admin inbox, most recent first. */
export async function listRooms() {
  const customers = await getPaymentDb().customer.findMany({
    where: {chatMessages: {some: {}}}, take: 200,
    select: {id: true, name: true, email: true, chatMessages: {orderBy: {createdAt: 'desc'}, take: 1, select: {body: true, imageId: true, authorRole: true, createdAt: true}}}
  });
  return customers.map(customer => {
    const last = customer.chatMessages[0];
    return {id: roomFor(customer.id), name: customer.name, email: customer.email, lastMessage: last ? {body: last.imageId && !last.body ? '[Image]' : last.body, createdAt: last.createdAt.toISOString(), role: (last.authorRole === 'admin' ? 'admin' : 'user') as Role} : null};
  }).sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
}

export async function roomImageCount(customerId: string) {
  return getPaymentDb().chatMessage.count({where: {customerId, imageId: {not: null}}});
}

export async function addMessage(input: {customerId: string; role: Role; authorName: string; body: string; image?: {bytes: Uint8Array<ArrayBuffer>; mimeType: string; name: string}}) {
  const db = getPaymentDb();
  const row = await db.chatMessage.create({
    data: {
      customer: {connect: {id: input.customerId}}, authorRole: input.role === 'admin' ? 'admin' : 'customer', authorName: input.authorName.slice(0, 80), body: input.body,
      ...(input.image ? {image: {create: {data: input.image.bytes, mimeType: input.image.mimeType, name: input.image.name, sizeBytes: input.image.bytes.byteLength}}} : {})
    },
    select: messageSelect
  });
  return toMessage(row);
}

/** Image bytes plus the owning conversation, for the access check in the image route. */
export async function chatImage(id: string) {
  return getPaymentDb().chatImage.findUnique({where: {id}, select: {data: true, mimeType: true, sizeBytes: true, message: {select: {customerId: true}}}});
}
