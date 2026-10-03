'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {MAX_AMOUNT, sliderTop, UNLIMITED_STOCK, type AmountSlider} from '@/lib/amount-slider-rules';
import {formatUsdFromVnd, formatVnd} from '@/lib/money';
import {LoadingRows} from '@/components/loading-state';

type Package = {id: string; title: string; priceVnd: number; stock: number};

/** Admin settings for the storefront amount slider: which package sets the unit price, the range and the wording. */
export default function SliderSettings() {
  const locale = useLocale();
  const [slider, setSlider] = useState<AmountSlider | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [vndPerUsd, setVndPerUsd] = useState(25000);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings/slider', {cache: 'no-store'}).then(async response => {
      if (response.status === 403) { window.location.assign(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setSlider(body.slider); setPackages(body.packages); setVndPerUsd(body.vndPerUsd); setSaved(Boolean(body.saved));
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Settings could not be loaded.'));
  }, [locale]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!slider) return;
    setBusy(true); setError(''); setMessage('');
    const response = await fetch('/api/admin/settings/slider', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(slider)}).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) { setError(body?.error ?? 'Settings could not be saved.'); return; }
    setSlider(body.slider); setSaved(true); setMessage(body.slider.enabled ? 'Saved. The slider is live on the store.' : 'Saved. The slider is off.');
  }

  const set = <K extends keyof AmountSlider>(key: K, value: AmountSlider[K]) => setSlider(current => current && {...current, [key]: value});
  const number = (key: 'unitSize' | 'min' | 'max' | 'step' | 'defaultAmount', label: string, hint: string) => <label>{label}<input type="number" min="1" max={MAX_AMOUNT} step="1" required value={slider?.[key] ?? ''} onChange={event => set(key, Math.floor(Number(event.target.value)))}/><small className="field-caption">{hint}</small></label>;
  const chosen = packages.find(item => item.id === slider?.packageId);

  return <div className="page-heading"><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / AMOUNT SLIDER</p><h1>Amount slider</h1>
    <p className="notice">A card above the packages where customers drag to any amount. Choose a package and say how much one package holds: with the <strong>100M</strong> package, “one package holds 100 M coins” lets customers pick 100M, 200M, 300M… and pay the package price for each 100M.</p>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}
    {slider && !saved && <p className="admin-feedback success" role="status">Not saved yet: the store already shows this automatic slider, built from the smallest package whose name starts with an amount (like “100M”). Change anything and save to take control.</p>}
    {!slider ? !error && <LoadingRows label="Loading slider settings…"/> : <form className="card admin-panel slider-settings" onSubmit={event => void save(event)}>
      <label className="admin-compact-check"><input type="checkbox" checked={slider.enabled} onChange={event => set('enabled', event.target.checked)}/> Show the slider on the store</label>
      <label>Package that sets the price per unit<select value={slider.packageId} onChange={event => set('packageId', event.target.value)}>
        <option value="">Choose a package…</option>
        {packages.map(item => <option key={item.id} value={item.id}>{item.title} · {formatVnd(item.priceVnd)} per unit</option>)}
      </select></label>
      {chosen && sliderTop(slider, chosen.stock) < slider.max && <p className="admin-feedback error">Only {chosen.stock} in stock, so customers can choose at most {sliderTop(slider, chosen.stock)} {slider.unitLabel}. For unlimited stock, set this package’s stock to {MAX_AMOUNT.toLocaleString('en-US')} in Products.</p>}
      <div className="admin-field-row">
        <label>Title<input value={slider.title} maxLength={80} required onChange={event => set('title', event.target.value)}/></label>
        <label>Unit shown after the amount<input value={slider.unitLabel} maxLength={24} required placeholder="M coins" onChange={event => set('unitLabel', event.target.value)}/></label>
      </div>
      <div className="admin-field-row">
        {number('unitSize', `One package holds (${slider.unitLabel})`, 'For example 100 for the 100M package. Amounts below must be multiples of it.')}
        {number('min', 'Smallest amount', 'The slider starts here.')}
        {number('max', 'Largest amount', 'The slider ends here.')}
        {number('step', 'Step', 'Dragging moves by this much.')}
        {number('defaultAmount', 'Starting amount', 'Selected when the page opens.')}
      </div>
      <label className="admin-compact-check"><input type="checkbox" checked={slider.hideFromGrid} onChange={event => set('hideFromGrid', event.target.checked)}/> Hide this package from the package grid (customers buy it with the slider only)</label>
      {chosen && <p className="field-caption slider-preview">Preview: {slider.defaultAmount} {slider.unitLabel} = <strong>{formatUsdFromVnd(chosen.priceVnd * slider.defaultAmount / slider.unitSize, vndPerUsd)}</strong> ({formatVnd(Math.round(chosen.priceVnd * slider.defaultAmount / slider.unitSize))}) · {slider.max} {slider.unitLabel} = <strong>{formatUsdFromVnd(chosen.priceVnd * slider.max / slider.unitSize, vndPerUsd)}</strong>{chosen.stock >= UNLIMITED_STOCK ? ' · always in stock' : ''}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save slider'}</button>
    </form>}
  </div>;
}
