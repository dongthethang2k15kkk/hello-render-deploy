import {randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {canManageReceivers, paymentRole} from '@/lib/payment-auth';

export const runtime = 'nodejs';
const MAX_BYTES = 5 * 1024 * 1024;
const types = new Map([
  ['image/png', {extension: 'png', magic: [0x89, 0x50, 0x4e, 0x47]}],
  ['image/jpeg', {extension: 'jpg', magic: [0xff, 0xd8, 0xff]}],
  ['image/webp', {extension: 'webp', magic: [0x52, 0x49, 0x46, 0x46] }]
]);

export async function POST(request: Request) {
  if (!canManageReceivers(paymentRole(request))) return Response.json({error: 'Admin role required'}, {status: 403});
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BYTES + 100000) return Response.json({error: 'Image must be 5 MB or smaller'}, {status: 413});
  let form: FormData;
  try {form = await request.formData();} catch {return Response.json({error: 'Invalid multipart upload'}, {status: 400});}
  const value = form.get('file');
  if (!(value instanceof File)) return Response.json({error: 'Choose an image file'}, {status: 400});
  const spec = types.get(value.type);
  if (!spec || value.size === 0 || value.size > MAX_BYTES) return Response.json({error: 'Only PNG, JPEG or WebP images up to 5 MB are allowed'}, {status: 400});
  const bytes = new Uint8Array(await value.arrayBuffer());
  const matchesMagic = spec.magic.every((byte, index) => bytes[index] === byte);
  const webpHeader = spec.extension === 'webp' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (!matchesMagic || (spec.extension === 'webp' && !webpHeader)) return Response.json({error: 'File content does not match its image type'}, {status: 400});
  const filename = `${randomUUID()}.${spec.extension}`;
  const directory = path.join(process.cwd(), 'public', 'payment-qr');
  await mkdir(directory, {recursive: true});
  await writeFile(path.join(directory, filename), bytes, {flag: 'wx'});
  return Response.json({path: `/payment-qr/${filename}`, filename});
}