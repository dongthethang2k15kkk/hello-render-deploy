import {createHash} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {getSession} from '@/lib/auth';
import {announcementImagePaths} from '@/lib/announcements';
import {getPaymentDb} from '@/lib/payment-db';
import {cleanImageFilename, MAX_PRODUCT_IMAGE_BYTES, productImageId, productImageTypes, validProductImageSignature} from '@/lib/product-image';

export const runtime = 'nodejs';

async function isAdmin() {
  return (await getSession())?.role === 'admin';
}

export async function POST(request: Request) {
  if (!await isAdmin()) return Response.json({error: 'Admin role required'}, {status: 403});
  if (!process.env.DATABASE_URL) return Response.json({error: 'Database is not configured'}, {status: 503});
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_PRODUCT_IMAGE_BYTES + 100_000) return Response.json({error: 'Image must be 2 MB or smaller after optimization'}, {status: 413});

  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({error: 'Invalid image upload'}, {status: 400}); }
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({error: 'Choose an image file'}, {status: 400});
  if (!productImageTypes.has(file.type) || file.size === 0 || file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return Response.json({error: 'Use a PNG, JPEG or WebP image up to 2 MB'}, {status: 400});
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validProductImageSignature(file.type, bytes)) return Response.json({error: 'File content does not match its image type'}, {status: 400});
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const db = getPaymentDb();

  try {
    const stale = await db.productImage.findMany({where: {createdAt: {lt: new Date(Date.now() - 24 * 60 * 60 * 1000)}}, select: {id: true}, take: 100});
    if (stale.length) {
      const paths = stale.map(image => `/api/product-images/${image.id}`);
      const referenced = await db.product.findMany({where: {imagePath: {in: paths}}, select: {imagePath: true}});
      // Images are shared by products and storefront announcements; keep anything either one uses.
      const used = new Set([...referenced.map(product => product.imagePath), ...await announcementImagePaths()]);
      const unusedIds = stale.filter(image => !used.has(`/api/product-images/${image.id}`)).map(image => image.id);
      if (unusedIds.length) await db.productImage.deleteMany({where: {id: {in: unusedIds}}});
    }
    const existing = await db.productImage.findUnique({where: {sha256}, select: {id: true, sizeBytes: true, mimeType: true}});
    if (existing) return Response.json({path: `/api/product-images/${existing.id}`, sizeBytes: existing.sizeBytes, mimeType: existing.mimeType, reused: true});
    const image = await db.productImage.create({data: {sha256, mimeType: file.type, originalName: cleanImageFilename(file.name), sizeBytes: file.size, data: bytes}, select: {id: true, sizeBytes: true, mimeType: true}});
    return Response.json({path: `/api/product-images/${image.id}`, sizeBytes: image.sizeBytes, mimeType: image.mimeType, reused: false}, {status: 201});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const image = await db.productImage.findUnique({where: {sha256}, select: {id: true, sizeBytes: true, mimeType: true}});
      if (image) return Response.json({path: `/api/product-images/${image.id}`, sizeBytes: image.sizeBytes, mimeType: image.mimeType, reused: true});
    }
    console.error('Product image upload failed', error instanceof Error ? error.message : error);
    return Response.json({error: 'Image storage is unavailable'}, {status: 503});
  }
}

export async function DELETE(request: Request) {
  if (!await isAdmin()) return Response.json({error: 'Admin role required'}, {status: 403});
  if (!process.env.DATABASE_URL) return Response.json({error: 'Database is not configured'}, {status: 503});
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!productImageId(`/api/product-images/${id}`)) return Response.json({error: 'Invalid image id'}, {status: 400});
  const path = `/api/product-images/${id}`;
  try {
    const references = await getPaymentDb().product.count({where: {imagePath: path}});
    if (references > 0) return Response.json({error: 'This image is still used by a product'}, {status: 409});
    if ((await announcementImagePaths()).has(path)) return Response.json({error: 'This image is still used by an announcement'}, {status: 409});
    const result = await getPaymentDb().productImage.deleteMany({where: {id}});
    return Response.json({ok: true, deleted: result.count === 1});
  } catch {
    return Response.json({error: 'Image could not be removed'}, {status: 503});
  }
}
