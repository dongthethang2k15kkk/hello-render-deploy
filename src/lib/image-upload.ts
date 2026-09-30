// Browser-side image preparation and upload shared by Products and Announcements (uses canvas; client only).
import {MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_IMAGE_SOURCE_BYTES, productImageTypes} from './product-image';

/** Resizes large images to at most 1800 px and re-encodes them as WebP so uploads stay under 2 MB. */
export async function prepareImage(file: File) {
  if (!productImageTypes.has(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (file.size === 0 || file.size > MAX_PRODUCT_IMAGE_SOURCE_BYTES) throw new Error('Choose an image up to 12 MB. Large images are optimized before upload.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This image could not be read. Try exporting it as PNG, JPEG or WebP.'); }
  try {
    const maxDimension = 1800;
    if (file.size <= MAX_PRODUCT_IMAGE_BYTES && bitmap.width <= maxDimension && bitmap.height <= maxDimension) return file;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image optimization is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob || blob.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error('The optimized image is still over 2 MB. Choose a smaller image.');
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'image';
    return new File([blob], `${baseName}.webp`, {type: 'image/webp'});
  } finally { bitmap.close(); }
}

/** Uploads a prepared image to the database-backed image store and returns its public path. */
export async function uploadImage(file: File) {
  const prepared = await prepareImage(file);
  const form = new FormData(); form.set('file', prepared);
  const response = await fetch('/api/admin/product-images', {method: 'POST', body: form});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Image could not be uploaded.');
  return data as {path: string; sizeBytes: number; reused: boolean};
}
