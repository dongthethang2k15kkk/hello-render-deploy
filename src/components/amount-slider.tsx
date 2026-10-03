'use client';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {snapAmount, type AmountSlider} from '@/lib/amount-slider-rules';
import type {CatalogProduct} from '@/lib/catalog';
import {cartLineSchema, createCartSchema} from '@/lib/cart';
import {formatLtcEstimate} from '@/lib/exchange-rate-rules';
import {formatUsdFromVnd, formatVnd} from '@/lib/money';
import {useCart} from './cart-provider';
import {useCatalog} from './catalog-provider';

const formatAmount = (value: number) => value.toLocaleString('en-US');

/** Glass card above the packages: drag to any amount of the per-unit package, see the price live, buy in one step. */
export function AmountSliderCard({slider, product, vndPerUsd, vndPerLtc}: {slider: AmountSlider; product: CatalogProduct; vndPerUsd: number; vndPerLtc: number | null}) {
  const locale = useLocale();
  const router = useRouter();
  const {lines, save, ready} = useCart();
  const catalog = useCatalog();
  const top = Math.min(slider.max, product.stock);
  const [amount, setAmount] = useState(() => snapAmount(slider.defaultAmount, slider, product.stock));
  const [typed, setTyped] = useState(String(amount));
  const [delivery, setDelivery] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const soldOut = product.stock < slider.min;
  const pick = (value: number) => { const next = snapAmount(value, slider, product.stock); setAmount(next); setTyped(String(next)); };
  const presets = [...new Set([slider.min, slider.min + (top - slider.min) / 4, slider.min + (top - slider.min) / 2, top].map(value => snapAmount(value, slider, product.stock)))];
  const fill = top > slider.min ? ((amount - slider.min) / (top - slider.min)) * 100 : 100;
  const vnd = product.priceVnd * amount;

  function buy(event: React.FormEvent) {
    event.preventDefault();
    const line = cartLineSchema.safeParse({productId: product.id, quantity: amount, delivery: Object.fromEntries(product.fields.map(field => [field.key, (delivery[field.key] ?? '').trim()]))});
    const next = line.success ? [...lines, line.data] : null;
    if (!next || !createCartSchema(catalog.products).safeParse(next).success) { setStatus('Check the details and the amount.'); return; }
    if (!save(next)) { setStatus('Unable to save the cart on this device.'); return; }
    setStatus('Added to cart. Opening your cart…');
    router.push(`/${locale}/cart`);
  }

  return <form className="card amount-slider" onSubmit={buy} aria-label={slider.title}>
    <div className="amount-slider-head">
      <div><p className="eyebrow">ANY AMOUNT</p><h3>{slider.title}</h3><p className="muted">{product.title.en} · 1 {slider.unitLabel} = {formatUsdFromVnd(product.priceVnd, vndPerUsd)}</p></div>
      <div className="amount-slider-price" aria-live="polite"><span className="amount-slider-amount">{formatAmount(amount)} <small>{slider.unitLabel}</small></span><strong>{formatUsdFromVnd(vnd, vndPerUsd)}</strong><small>{formatVnd(vnd)}{vndPerLtc ? ` · ≈ ${formatLtcEstimate(vnd, vndPerLtc)}` : ''}</small></div>
    </div>
    {soldOut ? <p className="error-text">Out of stock right now. Message us in Chat for a custom amount.</p> : <>
      <div className="amount-slider-control">
        <input type="range" aria-label={`Amount in ${slider.unitLabel}`} min={slider.min} max={top} step={slider.step} value={amount} style={{'--fill': `${fill}%`} as React.CSSProperties} onChange={event => pick(Number(event.target.value))}/>
        <label className="amount-slider-input"><span className="sr-only">Exact amount</span><input type="number" inputMode="numeric" min={slider.min} max={top} step={slider.step} value={typed} onChange={event => setTyped(event.target.value)} onBlur={() => pick(Number(typed))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); pick(Number(typed)); } }}/><small>{slider.unitLabel}</small></label>
      </div>
      <div className="amount-slider-presets">{presets.map(value => <button key={value} type="button" className={`secondary ${value === amount ? 'active' : ''}`} aria-pressed={value === amount} onClick={() => pick(value)}>{formatAmount(value)}</button>)}</div>
      {product.fields.length > 0 && <div className="amount-slider-fields">{product.fields.map(field => <label key={field.key}>{field.labelEn}<input value={delivery[field.key] ?? ''} required={field.required} maxLength={field.maxLength} autoComplete="off" onChange={event => setDelivery(current => ({...current, [field.key]: event.target.value}))}/></label>)}</div>}
      <div className="amount-slider-actions"><button type="submit" disabled={!ready}>Buy {formatAmount(amount)} {slider.unitLabel} · {formatUsdFromVnd(vnd, vndPerUsd)} <span aria-hidden="true">→</span></button><p className="form-status" role="status" aria-live="polite">{status}</p></div>
    </>}
  </form>;
}
