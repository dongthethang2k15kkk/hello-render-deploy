import {getSession} from '@/lib/auth';
import {roomFor} from '@/lib/chat-store';
import {subscribeChat, type ChatChange} from '@/lib/chat-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const state = globalThis as unknown as {chatConnections?: Map<string, number>};
const connections = state.chatConnections ??= new Map<string, number>();

export async function GET(request: Request) {
  const account = await getSession();
  if (!account) return new Response('Sign in required.', {status: 401});
  const key = `${account.role}:${account.id}`;
  if ((connections.get(key) ?? 0) >= 8) return new Response('Too many connections.', {status: 429});
  connections.set(key, (connections.get(key) ?? 0) + 1);
  let dispose = () => {};
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let checking = false;
      const pending = new Map<string, ChatChange>();
      const write = (value: string) => {if (!closed) controller.enqueue(encoder.encode(value));};
      const unsubscribe = subscribeChat(change => {
        if (account.role === 'user' && change.room !== roomFor(account.id)) return;
        if (pending.size >= 256) {dispose(); return;}
        pending.set(change.message?.id ?? `${change.room}:${change.kind}`, change);
        void flush();
      });
      // Recheck the session before emitting; room filtering is enforced above for customers.
      async function flush() {
        if (checking || closed) return;
        checking = true;
        try {
          const current = await getSession();
          if (!current || current.id !== account!.id || current.role !== account!.role) {dispose(); return;}
          for (const change of pending.values()) write(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
          pending.clear();
          write(': heartbeat\n\n');
        } catch { dispose(); }
        finally { checking = false; }
      }
      const heartbeat = setInterval(() => void flush(), 15000);
      // A bounded connection also refreshes cookie/session state and recovers deploys.
      const lifetime = setTimeout(() => dispose(), 5 * 60000);
      dispose = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat); clearTimeout(lifetime); unsubscribe(); pending.clear();
        request.signal.removeEventListener('abort', dispose);
        const remaining = (connections.get(key) ?? 1) - 1;
        if (remaining) connections.set(key, remaining); else connections.delete(key);
        try { controller.close(); } catch { /* already cancelled */ }
      };
      request.signal.addEventListener('abort', dispose, {once: true});
      if (request.signal.aborted) {dispose(); return;}
      write('retry: 3000\nevent: ready\ndata: {}\n\n');
    },
    cancel() {dispose();}
  });
  return new Response(stream, {headers: {'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-cache, no-transform', 'X-Accel-Buffering': 'no'}});
}
