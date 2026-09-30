import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {base58Encode, bech32Decode, uniqueLitoshi, validBase58Address, validLitecoinAddress} from '../../src/lib/ltc';
import {formatLtc, litecoinUri, parseLtc} from '../../src/lib/ltc-format';

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest();
function base58Check(version: number, payload: Uint8Array) {
  const body = Uint8Array.from([version, ...payload]);
  return base58Encode(Uint8Array.from([...body, ...sha256(sha256(body)).subarray(0, 4)]));
}
const tamper = (address: string) => address.slice(0, -1) + (address.endsWith('a') ? 'b' : 'a');

describe('Base58Check', () => {
  it('accepts the Bitcoin genesis address with its own version byte', () => {
    expect(validBase58Address('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', [0x00])).toBe(true);
    expect(validBase58Address('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb', [0x00])).toBe(false);
  });
  it('accepts well-formed Litecoin L/M/3 addresses and rejects typos', () => {
    const hash = new Uint8Array(20).fill(7);
    for (const version of [0x30, 0x32, 0x05]) {
      const address = base58Check(version, hash);
      expect(validLitecoinAddress(address)).toBe(true);
      expect(validLitecoinAddress(tamper(address))).toBe(false);
    }
    expect(address0x00()).toBe(false);
    function address0x00() { return validLitecoinAddress(base58Check(0x00, hash)); }
  });
});

describe('Bech32 / Bech32m', () => {
  it('verifies the BIP173 and BIP350 test vectors', () => {
    expect(bech32Decode('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', 'bc')).toMatchObject({version: 0});
    expect(bech32Decode('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', 'bc')?.program).toHaveLength(20);
    expect(bech32Decode('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0', 'bc')).toMatchObject({version: 1});
    expect(bech32Decode('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T5', 'bc')).toBeNull();
    expect(bech32Decode('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'ltc')).toBeNull();
    expect(bech32Decode('Bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'bc')).toBeNull();
  });
  it('rejects Bitcoin addresses as Litecoin receivers', () => {
    expect(validLitecoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false);
    expect(validLitecoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false);
  });
});

describe('Litecoin amounts', () => {
  it('formats and parses litoshi exactly', () => {
    expect(formatLtc(BigInt(12345678))).toBe('0.12345678');
    expect(formatLtc(BigInt(150000000))).toBe('1.50000000');
    expect(parseLtc('0.1')).toBe(BigInt(10000000));
    expect(parseLtc('1.123456789')).toBeNull();
  });
  it('covers the VND total and makes each open order amount unique', () => {
    // 260,000 VND at 2,000,000 VND/LTC = 0.13 LTC exactly = 13,000,000 litoshi.
    const first = uniqueLitoshi(260000, 2000000, new Set(), () => 0);
    expect(first).toBe(BigInt(13000001));
    const second = uniqueLitoshi(260000, 2000000, new Set([first]), () => 0);
    expect(second).toBe(BigInt(13000002));
    expect(Number(uniqueLitoshi(1, 3, new Set()))).toBeGreaterThanOrEqual(33333334);
  });
  it('builds a wallet URI with amount and order note', () => {
    expect(litecoinUri('ltc1qexample', '0.13000001', 'JH222222')).toBe('litecoin:ltc1qexample?amount=0.13000001&label=Jewish%20Horse&message=Order%20JH222222');
  });
});
