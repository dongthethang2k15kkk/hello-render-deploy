import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';
import {addMessage, customerIdFromRoom, listMessages, listRooms, markAdminRead, markCustomerRead, MAX_CHAT_IMAGE_BYTES, MAX_CHAT_IMAGES_PER_ROOM, roomFor, roomImageCount} from '@/lib/chat-store';
import {sameOrigin} from '@/lib/customer-rules';
import {validProductImageSignature} from '@/lib/product-image';

export const runtime = 'nodejs';
const unavailable = () => NextResponse.json({error: 'Chat is unavailable right now.'}, {status: 503});

export async function GET(request: Request) {
  const account = await getSession();
  if (!account) return NextResponse.json({error: 'Sign in required.'}, {status: 401});
  if (!process.env.DATABASE_URL) return unavailable();
  try {
    if (account.role === 'admin') {
      const rooms = await listRooms();
      const requested = new URL(request.url).searchParams.get('room');
      const room = requested && rooms.some(item => item.id === requested) ? requested : rooms[0]?.id ?? '';
      const customerId = customerIdFromRoom(room);
      // Viewing a conversation marks it read for the whole Admin team.
      const selected = rooms.find(item => item.id === room);
      if (customerId && selected?.unread) { await markAdminRead(customerId); selected.unread = 0; }
      return NextResponse.json({rooms, messages: customerId ? await listMessages(customerId) : [], room});
    }
    const messages = await listMessages(account.id);
    // The chat panel only loads while it is open, so loading means the customer has seen the replies.
    const latestReply = messages.filter(message => message.role === 'admin').at(-1);
    if (latestReply) await markCustomerRead(account.id, new Date(latestReply.createdAt));
    return NextResponse.json({rooms: [], messages, room: roomFor(account.id)});
  } catch (error) {
    console.error('Chat load failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return unavailable();
  }
}

export async function POST(request: Request) {
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

  try {
    let customerId: string | null = account.role === 'user' ? account.id : null;
    if (account.role === 'admin') {
      const requested = read('room');
      const rooms = await listRooms();
      customerId = typeof requested === 'string' && rooms.some(item => item.id === requested) ? customerIdFromRoom(requested) : null;
    }
    if (!customerId) return NextResponse.json({error: 'Please select a valid conversation.'}, {status: 400});
    if (!isImage) return NextResponse.json({message: await addMessage({customerId, role: account.role, authorName: account.name, body})});

    const file = read('image');
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_CHAT_IMAGE_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return NextResponse.json({error: 'Only PNG, JPEG, WebP images up to 1 MB.'}, {status: 400});
    if (await roomImageCount(customerId) >= MAX_CHAT_IMAGES_PER_ROOM) return NextResponse.json({error: `This conversation already has ${MAX_CHAT_IMAGES_PER_ROOM} images. Older images are removed after 90 days.`}, {status: 400});
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validProductImageSignature(file.type, bytes)) return NextResponse.json({error: 'Invalid image content.'}, {status: 400});
    const image = {bytes, mimeType: file.type, name: file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 100) || 'image'};
    return NextResponse.json({message: await addMessage({customerId, role: account.role, authorName: account.name, body, image})});
  } catch (error) {
    console.error('Chat send failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return unavailable();
  }
}
