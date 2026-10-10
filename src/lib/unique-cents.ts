// Per-order cent amounts shared by USDT and PayPal (no Prisma; unit-tested through usdt.test.ts and paypal.test.ts).

const toCents = (amount: string) => Math.round(Number(amount) * 100);
export const formatCents = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;

/**
 * The smallest amount at or above `baseCents` that no other open order uses, in cents. Transfers that carry no note
 * (crypto, PayPal) are told apart by their exact amount. Null when 100 consecutive amounts are all taken.
 */
export function uniqueCents(baseCents: number, taken: Set<string>) {
  const used = new Set([...taken].map(toCents));
  for (let extra = 0; extra < 100; extra++) if (!used.has(baseCents + extra)) return baseCents + extra;
  return null;
}
