import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!process.env.DATABASE_URL) return new Response('Image storage is unavailable', {status: 503});
  const {id} = await params;
  if (!/^[a-z0-9]+$/.test(id)) return new Response('Image not found', {status: 404});
  try {
    const image = await getPaymentDb().productImage.findUnique({where: {id}, select: {data: true, mimeType: true, sizeBytes: true, sha256: true}});
    if (!image) return new Response('Image not found', {status: 404});
    const etag = `"${image.sha256}"`;
    if (request.headers.get('if-none-match') === etag) return new Response(null, {status: 304, headers: {ETag: etag, 'Cache-Control': 'public, max-age=31536000, immutable'}});
    const bytes = Uint8Array.from(image.data).buffer;
    return new Response(bytes, {headers: {
      'Content-Type': image.mimeType,
      'Content-Length': String(image.sizeBytes),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ETag: etag
    }});
  } catch {
    return new Response('Image storage is unavailable', {status: 503});
  }
}
