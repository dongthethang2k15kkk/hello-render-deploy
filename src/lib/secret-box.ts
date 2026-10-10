// AES-256-GCM sealing with a key derived (HKDF) from a secret and a purpose label (Node.js only; unit-tested).
import {createCipheriv, createDecipheriv, hkdfSync, randomBytes} from 'node:crypto';

const derive = (secret: string, info: string) => Buffer.from(hkdfSync('sha256', secret, 'jewish-horse', info, 32));

/** "iv.tag.data" in base64url. A different `info` gives a different key, so one purpose can never open another's data. */
export function seal(value: string, secret: string, info: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derive(secret, info), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}

/** The original text, or null when the data is damaged or was sealed with another secret or purpose. */
export function open(sealed: string, secret: string, info: string) {
  try {
    const [iv, tag, data] = sealed.split('.').map(part => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !data || iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', derive(secret, info), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch { return null; }
}
