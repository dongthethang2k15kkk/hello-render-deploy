// Pure matching rules for automatic payment detection (no Node.js or Prisma imports).

type ExplorerTx = {txid: string; status: {confirmed: boolean; block_height?: number; block_time?: number}; vout: {scriptpubkey_address?: string; value: number}[]};

/**
 * Finds the transaction paying exactly `litoshi` to `address` (the unique per-order amount), ignoring transactions
 * confirmed well before the order existed. Returns the txid and its confirmation count.
 */
export function findLtcPayment(txs: ExplorerTx[], address: string, litoshi: bigint, notBefore: Date, tipHeight: number) {
  const earliest = notBefore.getTime() / 1000 - 600;
  for (const tx of txs) {
    if (tx.status.confirmed && (tx.status.block_time ?? 0) < earliest) continue;
    if (!tx.vout.some(output => output.scriptpubkey_address === address && BigInt(output.value) === litoshi)) continue;
    const confirmations = tx.status.confirmed && tx.status.block_height ? Math.max(0, tipHeight - tx.status.block_height + 1) : 0;
    return {txid: tx.txid, confirmations};
  }
  return null;
}

export const REQUIRED_LTC_CONFIRMATIONS = 2;
