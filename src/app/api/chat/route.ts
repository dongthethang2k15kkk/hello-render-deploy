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
  if (!account) return NextResponse.json({error: 'Bạn chưa đăng nhập.'}, {status: 401});
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
        return {id, name: customers.find(a => id === `user:${a.id}`)!.name, lastMessage: lastMessage ? {body: lastMessage.image ? '[Ảnh / Image]' : lastMessage.body, createdAt: lastMessage.createdAt} : null};
      }),
      messages: selectedRoom ? listMessages(selectedRoom, 'user') : [],
      room: selectedRoom
    });
  }
  return NextResponse.json({rooms: [], messages: listMessages(roomFor(account.id, account.role), account.role), room: roomFor(account.id, account.role)});
}

export async function POST(request: Request) {
  const account = await getSession();
  if (!account) return NextResponse.json({error: 'Bạn chưa đăng nhập.'}, {status: 401});
  const isImage = request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data');
  if (isImage && Number(request.headers.get('content-length')) > MAX_IMAGE_SIZE + 16384) return NextResponse.json({error: 'Ảnh tối đa 1 MB.'}, {status: 413});
  const data = isImage ? await request.formData().catch(() => null) : await request.json().catch(() => null);
  if (!data) return NextResponse.json({error: 'Dữ liệu không hợp lệ.'}, {status: 400});
  const bodyValue = isImage ? (data as FormData).get('body') : (data as {body?: unknown}).body;
  const body = typeof bodyValue === 'string' ? bodyValue.trim() : '';
  if (body.length > 1000 || (!body && !isImage)) return NextResponse.json({error: 'Tin nhắn phải có 1–1000 ký tự.'}, {status: 400});
  const roomValue = isImage ? (data as FormData).get('room') : (data as {room?: unknown}).room;
  const requestedRoom = typeof roomValue === 'string' ? roomValue : '';
  const room = account.role === 'user' ? roomFor(account.id, account.role) : listRooms().includes(requestedRoom) && customerAccounts().some(a => requestedRoom === `user:${a.id}`) ? requestedRoom : '';
  if (!room) return NextResponse.json({error: 'Vui lòng chọn cuộc trò chuyện hợp lệ.'}, {status: 400});
  if (!isImage) return NextResponse.json({message: addMessage(room, account.name, account.role, body)});
  const file = (data as FormData).get('image');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_SIZE || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return NextResponse.json({error: 'Chỉ nhận ảnh PNG, JPEG, WebP tối đa 1 MB.'}, {status: 400});
  if (listMessages(room, 'user').filter(message => message.image).length >= MAX_IMAGES_PER_ROOM) return NextResponse.json({error: 'Room đã đạt giới hạn 10 ảnh demo.'}, {status: 400});
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = imageType(bytes);
  if (mime !== file.type) return NextResponse.json({error: 'Nội dung ảnh không hợp lệ.'}, {status: 400});
  const image = {url: `data:${mime};base64,${bytes.toString('base64')}`, name: file.name.slice(0, 100) || 'image'};
  return NextResponse.json({message: addMessage(room, account.name, account.role, body, image)});
}