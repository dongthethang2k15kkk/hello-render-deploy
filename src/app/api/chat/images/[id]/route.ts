import {getSession} from '@/lib/auth';
import {chatImage} from '@/lib/chat-store';

export const runtime = 'nodejs';
const notFound = () => new Response('Image not found', {status: 404, headers: {'Cache-Control': 'no-store'}});

// Chat images are private: only the conversation owner and Admin can load them.
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const account = await getSession();
  if (!account || !process.env.DATABASE_URL) return notFound();
  const {id} = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return notFound();
  try {
    const image = await chatImage(id);
    if (!image?.message || (account.role !== 'admin' && image.message.customerId !== account.id)) return notFound();
    return new Response(Uint8Array.from(image.data).buffer, {headers: {
      'Content-Type': image.mimeType,
      'Content-Length': String(image.sizeBytes),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }});
  } catch {
    return new Response('Image storage is unavailable', {status: 503});
  }
}
