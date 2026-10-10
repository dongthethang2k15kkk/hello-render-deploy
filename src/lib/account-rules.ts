// Rules for game accounts for sale shared by the server and the browser (no Node.js imports; unit-tested).

export const ACCOUNT_STATUSES = ['draft', 'available', 'reserved', 'sold', 'hidden'] as const;
export type AccountStatus = typeof ACCOUNT_STATUSES[number];

export const accountStatusLabels: Record<AccountStatus, string> = {draft: 'Draft', available: 'Available', reserved: 'Reserved', sold: 'Sold', hidden: 'Hidden'};
export const accountStatusTone: Record<AccountStatus, 'warn' | 'ok' | 'danger' | 'info' | ''> = {draft: '', available: 'ok', reserved: 'warn', sold: 'info', hidden: 'danger'};

/** The three statuses an Admin picks freely. Reserved and sold only change through orders. */
export const ADMIN_STATUSES = ['draft', 'available', 'hidden'] as const;
export type AdminStatus = typeof ADMIN_STATUSES[number];

// Public code "SB" + 6 characters, from the same look-alike-free alphabet as order codes.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export function generateAccountCode(random: (size: number) => Uint8Array = size => globalThis.crypto.getRandomValues(new Uint8Array(size))) {
  return 'SB' + Array.from(random(6), byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}
export const accountCodePattern = /^SB[2-9A-HJ-NP-TV-Z]{6}$/;

type Listing = {status: string; priceVnd: number; salePriceVnd: number | null; hasLogin: boolean};

/** Why an Admin cannot move the account to `target`, or null when they can. */
export function statusProblem(account: Listing, target: string) {
  if (!(ADMIN_STATUSES as readonly string[]).includes(target)) return 'Choose Draft, Available or Hidden.';
  if (account.status === 'reserved') return 'A customer has this account in an unpaid order. Wait for the order to be paid or to expire, or cancel the order.';
  if (account.status === 'sold') return 'This account is sold.';
  if (target === 'available') {
    if (!account.hasLogin) return 'Add the login details before putting the account on sale.';
    if (!Number.isInteger(account.priceVnd) || account.priceVnd <= 0) return 'Set a price before putting the account on sale.';
    if (account.salePriceVnd !== null && (!Number.isInteger(account.salePriceVnd) || account.salePriceVnd <= 0 || account.salePriceVnd >= account.priceVnd)) return 'The sale price must be lower than the price.';
  }
  return null;
}

/** The price customers pay: the sale price when it is really lower. */
export const effectivePrice = (account: {priceVnd: number; salePriceVnd: number | null}) => account.salePriceVnd && account.salePriceVnd < account.priceVnd ? account.salePriceVnd : account.priceVnd;

/** An account that was never in an order can be deleted; anything reserved, sold or ordered stays for the records. */
export function deleteProblem(account: {status: string; orderId: string | null}, everOrdered: boolean) {
  if (account.status === 'reserved' || account.status === 'sold' || account.orderId) return 'This account is in an order, so it is kept for the records. Hide it instead.';
  if (everOrdered) return 'This account was in an order, so it is kept for the records. Hide it instead.';
  return null;
}

/** Status after an unpaid order is cancelled or expires. A login that was already handed over is never put back on sale. */
export const releasedStatus = (delivered: boolean): AccountStatus => delivered ? 'hidden' : 'available';
export const RELEASED_NOTE = 'Login details were revealed; change the password before relisting.';

/** An order with only game accounts has nothing to book: it is delivered as soon as the payment is confirmed. */
export const needsAppointment = (lines: {kind: string}[]) => lines.some(line => line.kind !== 'account');
