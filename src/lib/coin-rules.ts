const UNIT_MULTIPLIER: Record<string, bigint> = {K: BigInt(1000), M: BigInt(1000000), B: BigInt(1000000000), T: BigInt(1000000000000)};

/** Reads the coin quantity at the start of a package title, e.g. "100M coins". */
export function coinsFromTitle(title: string, quantity: number) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([KMBT])\b/i.exec(title);
  if (!match || !Number.isInteger(quantity) || quantity < 1) return BigInt(0);
  const [whole, fraction = ''] = match[1].split('.');
  const multiplier = UNIT_MULTIPLIER[match[2].toUpperCase()];
  const scale = BigInt(10) ** BigInt(fraction.length);
  const numeric = BigInt(whole) * scale + BigInt(fraction || '0');
  return numeric * multiplier * BigInt(quantity) / scale;
}

export function coinsFromOrderItems(items: Array<{title: string; quantity: number}>) {
  return items.reduce((sum, item) => sum + coinsFromTitle(item.title, item.quantity), BigInt(0));
}
