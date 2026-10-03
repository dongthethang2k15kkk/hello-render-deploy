'use client';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {formatUnits, lineAmount, shortTitle, sliderPresets, sliderTop, snapAmount, type AmountSlider} from '@/lib/amount-slider-rules';
import type {CatalogProduct} from '@/lib/catalog';
import {cartLineSchema, createCartSchema} from '@/lib/cart';
import {formatLtcEstimate} from '@/lib/exchange-rate-rules';
import {formatUsdFromVnd, formatVnd} from '@/lib/money';
import {useCart} from './cart-provider';
import {useCatalog} from './catalog-provider';
import {TradeFeed} from './trade-feed';

const CUSTOM = 'custom';

/**
 * The fast way to buy, at the top of the store: pick any amount on the slider or one of the packages, type the delivery
 * details and go straight to checkout (no product page, no cart). "Buy now" checks out exactly this item.
 */
export function QuickBuy({products, slider, vndPerUsd, vndPerLtc, trades}: {products: CatalogProduct[]; slider: AmountSlider | null; vndPerUsd: number; vndPerLtc: number | null; trades?: {completed: number; recent: {label: string; at: string}[]}}) {
  const locale = useLocale();
  const router = useRouter();
  const {save, ready} = useCart();
  const catalog = useCatalog();
  const sliderProduct = slider?.enabled ? products.find(product => product.id === slider.packageId) : undefined;
  const top = slider && sliderProduct ? sliderTop(slider, sliderProduct.stock) : 0;
  const custom = slider && sliderProduct && top >= slider.min ? {slider, product: sliderProduct} : null;
  const packages = products.filter(product => product.stock > 0 && !(custom && slider?.hideFromGrid && product.id === custom.product.id));
  const [choice, setChoice] = useState<string>(custom ? CUSTOM : packages[0]?.id ?? '');
  const [amount, setAmount] = useState(() => custom ? snapAmount(custom.slider.defaultAmount, custom.slider, custom.product.stock) : 0);
  const [typed, setTyped] = useState(String(amount));
  const [quantity, setQuantity] = useState(1);
  const [delivery, setDelivery] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  if (!custom && !packages.length) return null;

  const product = choice === CUSTOM && custom ? custom.product : packages.find(item => item.id === choice) ?? packages[0];
  const pick = (value: number) => { if (!custom) return; const next = snapAmount(value, custom.slider, custom.product.stock); setAmount(next); setTyped(String(next)); };
  const presets = custom ? sliderPresets(custom.slider, custom.product.stock) : [];
  const fill = custom && top > custom.slider.min ? ((amount - custom.slider.min) / (top - custom.slider.min)) * 100 : 100;
  // The cart holds packages: 300M of a 100M package is 3 packages.
  const count = choice === CUSTOM && custom ? amount / custom.slider.unitSize : quantity;
  const vnd = product.priceVnd * count;
  const label = choice === CUSTOM && custom ? formatUnits(amount, custom.slider.unitLabel) : lineAmount(product.title.en, quantity);
  const maxQuantity = Math.min(product.stock, 100);

  function buy(event: React.FormEvent) {
    event.preventDefault();
    const line = cartLineSchema.safeParse({productId: product.id, quantity: count, delivery: Object.fromEntries(product.fields.map(field => [field.key, (delivery[field.key] ?? '').trim()]))});
    if (!line.success || !createCartSchema(catalog.products).safeParse([line.data]).success) { setStatus('Check the details and the amount.'); return; }
    if (!save([line.data])) { setStatus('Unable to save your order on this device.'); return; }
    setStatus('Opening checkout…');
    router.push(`/${locale}/checkout`);
  }

  return <form id="buy" className="card amount-slider quick-buy" onSubmit={buy} aria-label="Buy now">
    <div className="amount-slider-head">
      <div><p className="eyebrow">BUY NOW</p><h3>{custom?.slider.title ?? 'Choose your package'}</h3><p className="muted">Pick an amount, add your details, then choose when to trade and pay. No account needed until checkout.</p></div>
      <div className="amount-slider-price" aria-live="polite"><span className="amount-slider-amount">{label}</span><strong>{formatUsdFromVnd(vnd, vndPerUsd)}</strong><small>{formatVnd(vnd)}{vndPerLtc ? ` · ≈ ${formatLtcEstimate(vnd, vndPerLtc)}` : ''}</small></div>
    </div>
    <div className="quick-buy-choices" role="radiogroup" aria-label="What to buy">
      {custom && <button type="button" role="radio" aria-checked={choice === CUSTOM} className={`secondary ${choice === CUSTOM ? 'active' : ''}`} onClick={() => setChoice(CUSTOM)}>Any amount</button>}
      {packages.map(item => <button key={item.id} type="button" role="radio" aria-checked={choice === item.id} className={`secondary ${choice === item.id ? 'active' : ''}`} onClick={() => { setChoice(item.id); setQuantity(1); }}>{shortTitle(item.title.en)} <small>{formatUsdFromVnd(item.priceVnd, vndPerUsd)}</small></button>)}
    </div>
    {choice === CUSTOM && custom ? <>
      <div className="amount-slider-control">
        <input type="range" aria-label={`Amount in ${custom.slider.unitLabel}`} min={custom.slider.min} max={top} step={custom.slider.step} value={amount} style={{'--fill': `${fill}%`} as React.CSSProperties} onChange={event => pick(Number(event.target.value))}/>
        <label className="amount-slider-input"><span className="sr-only">Exact amount</span><input type="number" inputMode="numeric" min={custom.slider.min} max={top} step={custom.slider.step} value={typed} onChange={event => setTyped(event.target.value)} onBlur={() => pick(Number(typed))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); pick(Number(typed)); } }}/><small>{custom.slider.unitLabel}</small></label>
      </div>
      <div className="amount-slider-presets">{presets.map(value => <button key={value} type="button" className={`secondary ${value === amount ? 'active' : ''}`} aria-pressed={value === amount} onClick={() => pick(value)}>{formatUnits(value, custom.slider.unitLabel)}</button>)}</div>
    </> : <div className="quick-buy-stepper"><span>Quantity</span>
      <button type="button" className="secondary" aria-label="Fewer" disabled={quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))}>−</button>
      <output aria-live="polite">{quantity}</output>
      <button type="button" className="secondary" aria-label="More" disabled={quantity >= maxQuantity} onClick={() => setQuantity(value => Math.min(maxQuantity, value + 1))}>+</button>
    </div>}
    {product.fields.length > 0 && <div className="amount-slider-fields">{product.fields.map(field => <label key={field.key}>{field.labelEn}<input value={delivery[field.key] ?? ''} required={field.required} maxLength={field.maxLength} autoComplete="off" onChange={event => setDelivery(current => ({...current, [field.key]: event.target.value}))}/></label>)}</div>}
    <div className="amount-slider-actions"><button type="submit" disabled={!ready}>Buy {label} · {formatUsdFromVnd(vnd, vndPerUsd)} <span aria-hidden="true">→</span></button><p className="form-status" role="status" aria-live="polite">{status}</p></div>
    {trades && <TradeFeed stats={trades}/>}
  </form>;
}
