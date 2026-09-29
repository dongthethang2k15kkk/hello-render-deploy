export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;
export const productImagePathPattern = /^\/api\/product-images\/([a-z0-9]+)$/;
export const legacyProductImagePathPattern = /^\/product-images\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/;

export const productImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validProductImageSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/webp') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export function productImageId(path: string) {
  return productImagePathPattern.exec(path)?.[1] ?? null;
}

export function cleanImageFilename(name: string) {
  return name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/]/g, '-').trim().slice(0, 160) || 'product-image';
}
