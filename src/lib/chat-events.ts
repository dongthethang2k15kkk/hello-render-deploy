/** One bus per Node process, shared across bundled route handlers. DB remains authoritative. */
import type {ChatMessage} from './chat-store';
export type ChatChange = {room: string; kind: 'message' | 'read'; message?: ChatMessage};
type Change = ChatChange;
type Listener = (change: Change) => void;
const state = globalThis as unknown as {shopChatListeners?: Set<Listener>};
const listeners = state.shopChatListeners ??= new Set<Listener>();

export function subscribeChat(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishChat(change: Change) {
  for (const listener of listeners) {
    try { listener(change); } catch { /* A disconnected client must never fail a saved message. */ }
  }
}
