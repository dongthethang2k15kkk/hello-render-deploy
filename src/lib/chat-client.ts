import type {ChatMessage} from './chat-store';

export type LocalMessage = ChatMessage & {status?: 'sending' | 'failed'; failure?: string};

/** A late snapshot cannot erase pending sends or messages received by a newer response. */
export function mergeMessages(current: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] {
  const confirmed = new Set(incoming.flatMap(message => message.clientMessageId ? [`${message.room}:${message.role}:${message.clientMessageId}`] : []));
  const merged = new Map(current.filter(message => !message.status || !message.clientMessageId || !confirmed.has(`${message.room}:${message.role}:${message.clientMessageId}`)).map(message => [message.id, message]));
  for (const message of incoming) merged.set(message.id, message);
  return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
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
