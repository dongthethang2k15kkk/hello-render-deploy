import {z} from 'zod';

export const receiverSchema = z.object({
  label: z.string().trim().min(1).max(80),
  method: z.enum(['bank', 'ltc']),
  destination: z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9]+$/),
  bank: z.string().trim().max(80),
  holder: z.string().trim().max(120),
  // Local, reviewed static assets only; never render arbitrary remote URLs.
  qrPath: z.string().regex(/^\/payment-qr\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/).or(z.literal('')),
  active: z.boolean(), pendingLimit: z.number().int().min(1).max(1000)
}).strict().superRefine((v, ctx) => {
  if (v.method === 'bank' && (!v.bank || !v.holder || !/^\d+$/.test(v.destination))) {
    ctx.addIssue({code: 'custom', message: 'Bank, holder and numeric account required'});
  }
  if (v.method === 'ltc' && !/^(ltc1[a-z0-9]{20,90}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v.destination)) {
    ctx.addIssue({code: 'custom', message: 'Expected Litecoin mainnet address; verify in your wallet before use'});
  }
});

export function quoteMinor(usdCents: number, unitsPerUsd: string) {
  if (!Number.isSafeInteger(usdCents) || usdCents <= 0 || !/^[1-9]\d{0,12}$/.test(unitsPerUsd)) throw new Error('Invalid quote');
  return (BigInt(usdCents) * BigInt(unitsPerUsd) + BigInt(99)) / BigInt(100);
}

export function paymentAmount(minor: string, method: string) {
  const value = BigInt(minor);
  if (method === 'bank') return `${value} VND`;
  return `${value / BigInt(100000000)}.${(value % BigInt(100000000)).toString().padStart(8, '0')} LTC`;
}

export function nextPaymentStatus(status: string, action: string) {
  if (action === 'report' && status === 'PENDING') return 'REVIEW';
  if (action === 'confirm' && status === 'REVIEW') return 'PAID';
  if (action === 'deliver' && status === 'PAID') return 'DELIVERED';
  throw new Error('Invalid state transition');
}