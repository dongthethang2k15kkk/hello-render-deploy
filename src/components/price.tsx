import {formatLtcEstimate} from '@/lib/exchange-rate-rules';
import {formatUsdFromVnd, formatVnd} from '@/lib/money';

/** USD (large) with the charged VND amount beneath (what bank transfers pay), plus an LTC estimate while Litecoin checkout is on. */
export default function Price({vnd, vndPerUsd, vndPerLtc = null, className = 'price'}: {vnd: number; vndPerUsd: number; vndPerLtc?: number | null; className?: string}) {
  const ltc = vndPerLtc ? formatLtcEstimate(vnd, vndPerLtc) : '';
  return <span className={`price-pair ${className}`}><span className="price-usd">{formatUsdFromVnd(vnd, vndPerUsd)}</span><span className="price-vnd">{formatVnd(vnd)}</span>{ltc && <span className="price-ltc">≈ {ltc}</span>}</span>;
}
