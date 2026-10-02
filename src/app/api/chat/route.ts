import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';
import {acknowledgeMessage, addMessage, customerIdFromRoom, forCustomer, messagePage, messageForRequest, validChatCustomer, listRooms, markAdminRead, markCustomerRead, MAX_CHAT_IMAGE_BYTES, MAX_CHAT_IMAGES_PER_ROOM, roomFor, roomImageCount} from '@/lib/chat-store';
import {sameOrigin} from '@/lib/customer-rules';
import {validProductImageSignature} from '@/lib/product-image';

export const runtime = 'nodejs';
const unavailable = () => NextResponse.json({error: 'Chat is unavailable right now.'}, {status: 503});

export async function GET(request: Request) {
  const started = performance.now();
  const account = await getSession();
  if (!account) return NextResponse.json({error: 'Sign in required.'}, {status: 401});
  if (!process.env.DATABASE_URL) return unavailable();
  const authMs = performance.now() - started;
  try {
    const query = new URL(request.url).searchParams;
    const rooms = account.role === 'admin' && query.get('rooms') !== '0' ? await listRooms() : undefined;
    if (query.get('rooms') === 'only') return NextResponse.json({rooms: rooms ?? []});
    const room = account.role === 'user' ? roomFor(account.id) : query.get('room') || rooms?.[0]?.id || '';
    const customerId = customerIdFromRoom(room);
    if (account.role === 'admin' && customerId && !(await validChatCustomer(customerId))) return NextResponse.json({error: 'Conversation not found.'}, {status: 404});
    const loaded = customerId ? await messagePage(customerId, query.get('after'), query.get('before')) : {messages: [], hasMore: false, hasOlder: false, cursor: null, oldest: null};
    const page = account.role === 'user' ? {...loaded, messages: loaded.messages.map(forCustomer)} : loaded;
    // Older clients retain their read-on-open contract; the new panel explicitly acknowledges rendered messages.
    if (query.get('read') !== '0' && customerId) {
      const latest = page.messages.filter(message => message.role !== account.role).at(-1);
      if (latest) {
        if (account.role === 'admin') await markAdminRead(customerId, new Date(latest.createdAt));
        else await markCustomerRead(customerId, new Date(latest.createdAt));
        const selected = rooms?.find(item => item.id === room);
        if (selected) selected.unread = 0;
      }
    }
    return NextResponse.json({...page, ...(rooms ? {rooms} : {}), room}, {headers: {'Cache-Control': 'private, no-store', 'Server-Timing': `auth;dur=${authMs.toFixed(1)}, chat;dur=${(performance.now() - started - authMs).toFixed(1)}`}});
  } catch (error) {
    console.error('Chat load failed', error instanceof Error ? error.message.trim().split('\n').at(-1) : error);
    return unavailable();
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request.headers)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const account = await getSession();
  if (!account) return NextResponse.json({error: 'Sign in required.'}, {status: 401});
  const data = await request.json().catch(() => null);
  const customerId = account.role === 'user' ? account.id : typeof data?.room === 'string' ? customerIdFromRoom(data.room) : null;
  if (!customerId || typeof data?.id !== 'string') return NextResponse.json({error: 'Invalid message.'}, {status: 400});
  try {
    const ok = await acknowledgeMessage(customerId, account.role, data.id);
    return NextResponse.json({ok}, {status: ok ? 200 : 404});
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  const started = performance.now();
  if (!sameOrigin(request.headers)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const account = await getSession();
  if (!account) return NextResponse.json({error: 'Sign in required.'}, {status: 401});
  if (!process.env.DATABASE_URL) return unavailable();
  const isImage = request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data');
  if (isImage && Number(request.headers.get('content-length')) > MAX_CHAT_IMAGE_BYTES + 16384) return NextResponse.json({error: 'Image must be 1 MB or less.'}, {status: 413});
  const data = isImage ? await request.formData().catch(() => null) : await request.json().catch(() => null);
  if (!data) return NextResponse.json({error: 'Invalid request data.'}, {status: 400});
  const read = (key: string) => isImage ? (data as FormData).get(key) : (data as Record<string, unknown>)[key];
  const bodyValue = read('body');
  const body = typeof bodyValue === 'string' ? bodyValue.trim() : '';
  if (body.length > 1000 || (!body && !isImage)) return NextResponse.json({error: 'Message must be 1–1000 characters.'}, {status: 400});

  const clientMessageId = read('clientMessageId');
  if (clientMessageId != null && (typeof clientMessageId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(clientMessageId))) return NextResponse.json({error: 'Invalid message identifier.'}, {status: 400});
  try {
    let customerId: string | null = account.role === 'user' ? account.id : null;
    if (account.role === 'admin') {
      const requested = read('room');
      customerId = typeof requested === 'string' ? customerIdFromRoom(requested) : null;
      if (customerId && !(await validChatCustomer(customerId))) customerId = null;
    }
    if (!customerId) return NextResponse.json({error: 'Please select a valid conversation.'}, {status: 400});
    const requestKey = typeof clientMessageId === 'string' ? createHash('sha256').update(JSON.stringify([account.role, account.id, customerId, clientMessageId])).digest('hex') : undefined;
    const input = {customerId, role: account.role, authorName: account.name, body, requestKey, clientMessageId: typeof clientMessageId === 'string' ? clientMessageId : undefined};
    const respond = (message: Awaited<ReturnType<typeof addMessage>>) => NextResponse.json({message}, {headers: {'Server-Timing': `send;dur=${(performance.now() - started).toFixed(1)}`}});
    if (requestKey) {const existing = await messageForRequest(requestKey); if (existing) return respond(existing);}
    if (!isImage) return respond(await addMessage(input));

    const file = read('image');
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_CHAT_IMAGE_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return NextResponse.json({error: 'Only PNG, JPEG, WebP images up to 1 MB.'}, {status: 400});
    if (await roomImageCount(customerId) >= MAX_CHAT_IMAGES_PER_ROOM) return NextResponse.json({error: `This conversation already has ${MAX_CHAT_IMAGES_PER_ROOM} images. Older images are removed after 90 days.`}, {status: 400});
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validProductImageSignature(file.type, bytes)) return NextResponse.json({error: 'Invalid image content.'}, {status: 400});
    const image = {bytes, mimeType: file.type, name: file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 100) || 'image'};
    return respond(await addMessage({...input, image}));
  } catch (error) {
    console.error('Chat send failed', error instanceof Error ? error.message.trim().split('\n').at(-1) : error);
    return unavailable();
  }
}
