import type {DemoRole} from './demo-auth';

export type ChatMessage = {id: string; room: string; author: string; role: DemoRole; body: string; createdAt: string; image?: {url: string; name: string}};
const rooms = new Map<string, ChatMessage[]>();

function seed(room: string, role: DemoRole) {
  if (rooms.has(room)) return;
  rooms.set(room, []);
}

export function roomFor(id: string, role: DemoRole) { return role === 'user' ? `user:${id}` : 'sales'; }
export function listMessages(room: string, role: DemoRole) { seed(room, role); return rooms.get(room) ?? []; }
export function listRooms() { return [...rooms.keys()].filter(room => room.startsWith('user:') && (rooms.get(room)?.length ?? 0) > 0); }
export function addMessage(room: string, author: string, role: DemoRole, body: string, image?: ChatMessage['image']) {
  seed(room, role);
  const message: ChatMessage = {id: crypto.randomUUID(), room, author, role, body, createdAt: new Date().toISOString(), ...(image ? {image} : {})};
  rooms.get(room)!.push(message);
  return message;
}