const ZERO = BigInt(0);

function coinValue(value: string | number | bigint | null | undefined) {
  try { return BigInt(value ?? 0); }
  catch { return ZERO; }
}

export function formatCoins(value: string | number | bigint | null | undefined) {
  return `${coinValue(value).toLocaleString('en-US')} coins`;
}

export function formatCompactCoins(value: string | number | bigint | null | undefined) {
  const amount = coinValue(value);
  const units = [
    {size: BigInt(1_000_000_000_000), suffix: 'T'},
    {size: BigInt(1_000_000_000), suffix: 'B'},
    {size: BigInt(1_000_000), suffix: 'M'},
    {size: BigInt(1_000), suffix: 'K'}
  ];
  for (const unit of units) {
    if (amount < unit.size) continue;
    const tenths = amount * BigInt(10) / unit.size;
    const whole = tenths / BigInt(10);
    const decimal = tenths % BigInt(10);
    return `${whole}${decimal === ZERO ? '' : `.${decimal}`}${unit.suffix}`;
  }
  return amount.toString();
}
