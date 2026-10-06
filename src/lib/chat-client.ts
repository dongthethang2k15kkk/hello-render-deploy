import type {ChatMessage} from './chat-store';

export type LocalMessage = ChatMessage & {status?: 'sending' | 'failed'; failure?: string};

/** A late snapshot cannot erase pending sends or messages received by a newer response. */
export function mergeMessages(current: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] {
  const confirmed = new Set(incoming.flatMap(message => message.clientMessageId ? [`${message.room}:${message.role}:${message.clientMessageId}`] : []));
  const merged = new Map(current.filter(message => !message.status || !message.clientMessageId || !confirmed.has(`${message.room}:${message.role}:${message.clientMessageId}`)).map(message => [message.id, message]));
  for (const message of incoming) merged.set(message.id, message);
  return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

// Formatters are built once: creating one per bubble on every render is what made long chats slow on phones.
const timeFormat = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit'});
const weekdayFormat = new Intl.DateTimeFormat('en-US', {weekday: 'short'});
const dayFormat = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric'});
const yearFormat = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
const DAY_MS = 86_400_000;

export const chatTime = (iso: string) => timeFormat.format(new Date(iso));

/** "2:05 PM" today, "Mon 2:05 PM" within the week, "Oct 3, 2:05 PM" this year, the year added before that. */
export function chatDividerLabel(at: Date, now = new Date()) {
  const time = timeFormat.format(at);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (at.getTime() >= today) return time;
  if (at.getTime() >= today - 6 * DAY_MS) return `${weekdayFormat.format(at)} ${time}`;
  return `${(at.getFullYear() === now.getFullYear() ? dayFormat : yearFormat).format(at)}, ${time}`;
}

/** Short time for a conversation list: the time today, the weekday this week, otherwise the date. */
export function chatListTime(iso: string, now = new Date()) {
  const at = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (at.getTime() >= today) return timeFormat.format(at);
  return at.getTime() >= today - 6 * DAY_MS ? weekdayFormat.format(at) : dayFormat.format(at);
}

export type ChatRow<M> = {message: M; mine: boolean; divider: string | null; position: 'single' | 'first' | 'middle' | 'last'};
const DIVIDER_GAP_MS = 15 * 60_000;
const GROUP_GAP_MS = 5 * 60_000;

/** Messenger layout: messages in a row from one side form a group; a 15-minute pause or a new day adds a time divider. */
export function chatRows<M extends {role: string; createdAt: string}>(messages: M[], viewer: string, now = new Date()): ChatRow<M>[] {
  const starts = messages.map((message, index) => {
    const previous = messages[index - 1];
    const at = new Date(message.createdAt);
    const before = previous ? new Date(previous.createdAt) : null;
    const divider = !before || at.getTime() - before.getTime() >= DIVIDER_GAP_MS || at.toDateString() !== before.toDateString() ? chatDividerLabel(at, now) : null;
    return {divider, first: Boolean(divider) || previous.role !== message.role || at.getTime() - before!.getTime() > GROUP_GAP_MS};
  });
  return messages.map((message, index) => {
    const {divider, first} = starts[index];
    const last = index === messages.length - 1 || starts[index + 1].first;
    return {message, mine: message.role === viewer, divider, position: first && last ? 'single' : first ? 'first' : last ? 'last' : 'middle'};
  });
}

type Update = {kind: 'message' | 'read' | 'connected' | 'disconnected'; room?: string; message?: ChatMessage};
const listeners = new Set<(event: Update) => void>();
let source: EventSource | undefined;
let connected = false;

/** Header, widget and inbox share one connection in this browser tab. */
export function watchChat(listener: (event: Update) => void) {
  listeners.add(listener);
  if (!source) {
    source = new EventSource('/api/chat/events');
    source.addEventListener('ready', () => {connected = true; listeners.forEach(fn => fn({kind: 'connected'}));});
    source.addEventListener('change', event => {
      try { const data = JSON.parse((event as MessageEvent).data) as Update; listeners.forEach(fn => fn(data)); } catch { /* reconnect performs catch-up */ }
    });
    source.onerror = () => {connected = false; listeners.forEach(fn => fn({kind: 'disconnected'}));};
  } else if (connected) queueMicrotask(() => {if (listeners.has(listener)) listener({kind: 'connected'});});
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {source?.close(); source = undefined; connected = false;}
  };
}
