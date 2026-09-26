import {timingSafeEqual} from 'node:crypto';

export function paymentRole(request: Request): 'admin' | null {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const secret = process.env.PAYMENT_ADMIN_KEY;
  if (secret && secret.length >= 32 && Buffer.byteLength(token) === Buffer.byteLength(secret) && timingSafeEqual(Buffer.from(token), Buffer.from(secret))) return 'admin';
  return null;
}

export function canManageReceivers(role: 'admin' | null) { return role === 'admin'; }
export function canProcessOrders(role: 'admin' | null) { return role === 'admin'; }