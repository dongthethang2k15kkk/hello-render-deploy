import {NextResponse} from 'next/server';
import {getSession} from '@/lib/demo-auth';
import {addMessage, listMessages, listRooms, roomFor} from '@/lib/demo-chat';
import {customerAccounts} from '@/lib/demo-accounts';

const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_IMAGES_PER_ROOM = 10;

function imageType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-1) === 0xd9) return 'image/jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function GET(request: Request) {
  const account = await getSession();
  if (!account) return NextResponse.json({error: 'Sign in required.'}, {status: 401});
  if (account.role !== 'user') {
    const rooms = listRooms();
    const customers = customerAccounts();
    const availableRooms = rooms.filter(room => customers.some(a => room === `user:${a.id}`));
    const room = new URL(request.url).searchParams.get('room');
    const selectedRoom = room && availableRooms.includes(room) ? room : availableRooms[0] ?? '';
    return NextResponse.json({
      rooms: availableRooms.map(id => {
        const history = listMessages(id, 'user');
        const lastMessage = history.at(-1);
        return {id, name: customers.find(a => id === `user:${a.id}`)!.name, lastMessage: lastMessage ? {body: lastMessage.image ? '[Image]' : lastMessage.body, createdAt: lastMessage.createdAt} : null};
      }),
      messages: selectedRoom ? listMessages(selectedRoom, 'user') : [],
      room: selectedRoom
    });
  }
  return NextResponse.json({rooms: [], messages: listMessages(roomFor(account.id, account.role), account.role), room: roomFor(account.id, account.role)});
}

export async function POST(request: Request) {
  const account = await getSession();
  if (!account) return NextResponse.json({error: 'Sign in required.'}, {status: 401});
  const isImage = request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data');
  if (isImage && Number(request.headers.get('content-length')) > MAX_IMAGE_SIZE + 16384) return NextResponse.json({error: 'Image must be 1 MB or less.'}, {status: 413});
  const data = isImage ? await request.formData().catch(() => null) : await request.json().catch(() => null);
  if (!data) return NextResponse.json({error: 'Invalid request data.'}, {status: 400});
  const bodyValue = isImage ? (data as FormData).get('body') : (data as {body?: unknown}).body;
  const body = typeof bodyValue === 'string' ? bodyValue.trim() : '';
  if (body.length > 1000 || (!body && !isImage)) return NextResponse.json({error: 'Message must be 1–1000 characters.'}, {status: 400});
  const roomValue = isImage ? (data as FormData).get('room') : (data as {room?: unknown}).room;
  const requestedRoom = typeof roomValue === 'string' ? roomValue : '';
  const room = account.role === 'user' ? roomFor(account.id, account.role) : listRooms().includes(requestedRoom) && customerAccounts().some(a => requestedRoom === `user:${a.id}`) ? requestedRoom : '';
  if (!room) return NextResponse.json({error: 'Please select a valid conversation.'}, {status: 400});
  if (!isImage) return NextResponse.json({message: addMessage(room, account.name, account.role, body)});
  const file = (data as FormData).get('image');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_SIZE || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return NextResponse.json({error: 'Only PNG, JPEG, WebP images up to 1 MB.'}, {status: 400});
  if (listMessages(room, 'user').filter(message => message.image).length >= MAX_IMAGES_PER_ROOM) return NextResponse.json({error: 'Room has reached the demo limit of 10 images.'}, {status: 400});
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = imageType(bytes);
  if (mime !== file.type) return NextResponse.json({error: 'Invalid image content.'}, {status: 400});
  const image = {url: `data:${mime};base64,${bytes.toString('base64')}`, name: file.name.slice(0, 100) || 'image'};
  return NextResponse.json({message: addMessage(room, account.name, account.role, body, image)});
}