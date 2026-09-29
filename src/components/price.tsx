import {formatUsdFromVnd, formatVnd} from '@/lib/money';

/** USD (large) with the charged VND amount beneath; VND is what customers transfer. */
export default function Price({vnd, vndPerUsd, className = 'price'}: {vnd: number; vndPerUsd: number; className?: string}) {
  return <span className={`price-pair ${className}`}><span className="price-usd">{formatUsdFromVnd(vnd, vndPerUsd)}</span><span className="price-vnd">{formatVnd(vnd)}</span></span>;
}
