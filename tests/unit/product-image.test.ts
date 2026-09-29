import {describe, expect, it} from 'vitest';
import {cleanImageFilename, productImageId, validProductImageSignature} from '../../src/lib/product-image';

describe('product image helpers', () => {
  it('recognizes supported image signatures', () => {
    expect(validProductImageSignature('image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(validProductImageSignature('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(true);
    expect(validProductImageSignature('image/webp', new TextEncoder().encode('RIFF0000WEBP'))).toBe(true);
    expect(validProductImageSignature('image/png', Uint8Array.from([1, 2, 3]))).toBe(false);
  });

  it('extracts only database-backed image ids', () => {
    expect(productImageId('/api/product-images/cmh123abc')).toBe('cmh123abc');
    expect(productImageId('/product-images/example.webp')).toBeNull();
  });

  it('removes path and control characters from original names', () => {
    expect(cleanImageFilename('../bad\u0000/name.webp')).toBe('..-bad-name.webp');
  });
});
