// Browser-safe Litecoin helpers: amounts in litoshi (1 LTC = 100,000,000 litoshi) and payment URIs.
export const LITOSHI_PER_LTC = BigInt(100_000_000);

export function formatLtc(litoshi: bigint) {
  const whole = litoshi / LITOSHI_PER_LTC;
  const fraction = (litoshi % LITOSHI_PER_LTC).toString().padStart(8, '0');
  return `${whole}.${fraction}`;
}

export function parseLtc(value: string) {
  const match = /^(\d{1,8})(?:\.(\d{1,8}))?$/.exec(value.trim());
  if (!match) return null;
  return BigInt(match[1]) * LITOSHI_PER_LTC + BigInt((match[2] ?? '').padEnd(8, '0'));
}

/** BIP21-style URI understood by Litecoin wallets: address, amount and a note with the order code. */
export function litecoinUri(address: string, amount: string, code: string) {
  return `litecoin:${address}?amount=${amount}&label=${encodeURIComponent('Jewish Horse')}&message=${encodeURIComponent(`Order ${code}`)}`;
}

export const explorerTx = (txid: string) => `https://litecoinspace.org/tx/${txid}`;
export const explorerAddress = (address: string) => `https://litecoinspace.org/address/${address}`;
export const txidPattern = /^[0-9a-fA-F]{64}$/;
