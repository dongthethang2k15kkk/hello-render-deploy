// Litecoin address validation (Base58Check and Bech32/Bech32m checksums) and per-order amounts.
// A mistyped receiving address would send customer money nowhere, so checksums are verified, not just shapes.
import {createHash} from 'node:crypto';
import {LITOSHI_PER_LTC} from './ltc-format';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
// BigInt constants (the TypeScript target predates BigInt literals).
const [ZERO, ONE, B58, B256, B999, B1000] = [0, 1, 58, 256, 999, 1000].map(BigInt);
const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest();

export function base58Decode(value: string) {
  let number = ZERO;
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return null;
    number = number * B58 + BigInt(digit);
  }
  const bytes: number[] = [];
  while (number > ZERO) { bytes.unshift(Number(number % B256)); number /= B256; }
  for (const char of value) { if (char !== '1') break; bytes.unshift(0); }
  return Uint8Array.from(bytes);
}

export function base58Encode(bytes: Uint8Array) {
  let number = ZERO;
  for (const byte of bytes) number = number * B256 + BigInt(byte);
  let out = '';
  while (number > ZERO) { out = BASE58[Number(number % B58)] + out; number /= B58; }
  for (const byte of bytes) { if (byte !== 0) break; out = '1' + out; }
  return out;
}

/** Litecoin mainnet versions: 0x30 (L…, P2PKH), 0x32 (M…, P2SH), 0x05 (3…, legacy P2SH). */
export function validBase58Address(address: string, versions: number[] = [0x30, 0x32, 0x05]) {
  const bytes = base58Decode(address);
  if (!bytes || bytes.length !== 25 || !versions.includes(bytes[0])) return false;
  const checksum = sha256(sha256(bytes.subarray(0, 21))).subarray(0, 4);
  return checksum.every((byte, index) => byte === bytes[21 + index]);
}

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values: number[]) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let bit = 0; bit < 5; bit++) if ((top >>> bit) & 1) checksum ^= generators[bit];
  }
  return checksum >>> 0;
}
const expandHrp = (hrp: string) => [...[...hrp].map(char => char.charCodeAt(0) >> 5), 0, ...[...hrp].map(char => char.charCodeAt(0) & 31)];

/** Returns the witness version and program, or null. Accepts Bech32 for v0 and Bech32m for v1+. */
export function bech32Decode(address: string, expectedHrp: string) {
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) return null;
  const lower = address.toLowerCase();
  const separator = lower.lastIndexOf('1');
  if (separator < 1 || separator + 7 > lower.length || lower.length > 90) return null;
  const hrp = lower.slice(0, separator);
  if (hrp !== expectedHrp) return null;
  const data = [...lower.slice(separator + 1)].map(char => BECH32.indexOf(char));
  if (data.some(value => value < 0)) return null;
  const constant = polymod([...expandHrp(hrp), ...data]);
  const version = data[0];
  if (version > 16 || constant !== (version === 0 ? 1 : 0x2bc830a3)) return null;
  // Convert 5-bit groups (without checksum) to bytes.
  let accumulator = 0; let bits = 0; const program: number[] = [];
  for (const value of data.slice(1, -6)) {
    accumulator = (accumulator << 5) | value; bits += 5;
    while (bits >= 8) { bits -= 8; program.push((accumulator >> bits) & 0xff); }
  }
  if (bits >= 5 || ((accumulator << (8 - bits)) & 0xff)) return null;
  if (program.length < 2 || program.length > 40 || (version === 0 && program.length !== 20 && program.length !== 32)) return null;
  return {version, program};
}

export function validLitecoinAddress(value: string) {
  const address = value.trim();
  if (/^ltc1/i.test(address)) return bech32Decode(address, 'ltc') !== null;
  return /^[LM3][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) && validBase58Address(address);
}

/**
 * Litoshi amount for an order: the VND total at the locked rate, rounded up to 1,000 litoshi, plus a
 * 1-999 litoshi tag that is unique among live orders on the same address, so payments can be told apart.
 */
export function uniqueLitoshi(totalVnd: number, vndPerLtc: number, taken: Set<bigint>, random: () => number = Math.random) {
  if (!Number.isInteger(totalVnd) || totalVnd <= 0 || !Number.isInteger(vndPerLtc) || vndPerLtc <= 0) throw new Error('Invalid amount or rate');
  const exact = (BigInt(totalVnd) * LITOSHI_PER_LTC + BigInt(vndPerLtc) - ONE) / BigInt(vndPerLtc);
  const base = ((exact + B999) / B1000) * B1000;
  const start = 1 + Math.floor(random() * 999);
  for (let offset = 0; offset < 999; offset++) {
    const candidate = base + BigInt(((start - 1 + offset) % 999) + 1);
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Too many open Litecoin orders at this amount');
}
