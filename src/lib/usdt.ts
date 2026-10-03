// USDT on TRON (TRC20): address checks, per-order amounts and matching transfers (no Prisma; unit-tested).
import {createHash} from 'node:crypto';
import {base58Decode} from './ltc';

/** The official Tether USD contract on TRON. Transfers of any other token are ignored. */
export const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const MICRO_PER_USDT = BigInt(1_000_000);
const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest();

/** TRON addresses are Base58Check with version byte 0x41 ("T…", 34 characters). A typo fails the checksum. */
export function validTronAddress(value: string) {
  const address = value.trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  const bytes = base58Decode(address);
  if (!bytes || bytes.length !== 25 || bytes[0] !== 0x41) return false;
  const checksum = sha256(sha256(bytes.subarray(0, 21))).subarray(0, 4);
  return checksum.every((byte, index) => byte === bytes[21 + index]);
}

const cents = (amount: string) => Math.round(Number(amount) * 100);
const formatCents = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;

/**
 * USDT to send for an order: the VND total at the locked USD rate, rounded up to the cent, plus the smallest extra
 * cent amount no other open order on the same address uses (crypto transfers carry no note to tell orders apart).
 */
export function usdtAmount(totalVnd: number, vndPerUsd: number, taken: Set<string>) {
  const base = Math.max(1, Math.ceil((totalVnd * 100) / vndPerUsd));
  const used = new Set([...taken].map(cents));
  for (let extra = 0; extra < 100; extra++) if (!used.has(base + extra)) return formatCents(base + extra);
  throw new Error('Too many open USDT orders on this address');
}

export function usdtToMicro(amount: string) {
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) return null;
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * MICRO_PER_USDT + BigInt(fraction.padEnd(6, '0'));
}

type Trc20Transfer = {transaction_id: string; to: string; value: string; block_timestamp: number; token_info?: {address?: string}};

/** The confirmed transfer of exactly this amount of USDT to the address, sent after the order was placed. */
export function findUsdtPayment(transfers: Trc20Transfer[], address: string, amount: string, notBefore: Date) {
  const micro = usdtToMicro(amount);
  if (micro === null) return null;
  const found = transfers.find(transfer => transfer.to === address && transfer.token_info?.address === USDT_TRC20_CONTRACT
    && transfer.block_timestamp >= notBefore.getTime() - 60_000 && /^\d+$/.test(transfer.value) && BigInt(transfer.value) === micro);
  return found ? {txid: found.transaction_id} : null;
}

export const tronscanTx = (txid: string) => `https://tronscan.org/#/transaction/${txid}`;
export const tronscanAddress = (address: string) => `https://tronscan.org/#/address/${address}`;
