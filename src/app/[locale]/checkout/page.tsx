'use client';

import Link from 'next/link';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {useOnlineAdmins} from '@/components/availability';
import {CheckoutSignIn} from '@/components/checkout-sign-in';
import {useCart} from '@/components/cart-provider';
import {useCatalog} from '@/components/catalog-provider';
import {browserTimeZone, buildTiming, defaultRow, SlotRows, soonRow, type Row} from '@/components/time-picker';
import {totalVnd} from '@/lib/cart';
import {Locale} from '@/lib/catalog';
import {formatUsdCents, formatUsdFromVnd, formatVnd} from '@/lib/money';
import {paypalBaseCents} from '@/lib/paypal';
import {formatLtcEstimate} from '@/lib/exchange-rate-rules';
import {ASAP_NOTICE, HOLD_MINUTES, MAX_SLOTS, type PaymentMethod} from '@/lib/order-rules';
import {LoadingRows} from '@/components/loading-state';
import {formatCoins} from '@/lib/coin-format';
import {invalidateJson, loadJson} from '@/lib/client-data-cache';

type Method = PaymentMethod;
type Methods = {bank: boolean; ltc: {vndPerLtc: number} | null; usdt: boolean; paypal: {feePercent: number; feeFixedCents: number} | null};

export default function Checkout() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const {lines, ready, save} = useCart();
  const catalog = useCatalog();
  const products = catalog.products;
  const online = useOnlineAdmins();
  const [account, setAccount] = useState<{name: string; role: string; coinBalance?: string} | null | false>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [methods, setMethods] = useState<Methods | null>(null);
  const [method, setMethod] = useState<Method>('bank');
  // "now" = trade as soon as the order is paid (only while an Admin is online); "schedule" = later times only.
  const [mode, setMode] = useState<'now' | 'schedule' | null>(null);
  const [rows, setRows] = useState<Row[]>([defaultRow(1)]);
  const [touched, setTouched] = useState(false);
  const [redeemWheelCoins, setRedeemWheelCoins] = useState(false);

  const loadAccount = (force = false) => loadJson<{account?: {name: string; role: string; coinBalance?: string} | null}>('/api/auth/session', {maxAgeMs: 15_000, force}).then(({data}) => setAccount(data.account ?? false)).catch(() => setAccount(false));
  useEffect(() => {
    // The cached session shows at once; the server copy confirms it, since placing the order needs the real one.
    void loadAccount().then(() => loadAccount(true));
    loadJson<Methods>('/api/payment-methods', {maxAgeMs: 60_000}).then(({data}) => {
      setMethods(data);
      if (!data.bank) setMethod(data.usdt ? 'usdt' : data.ltc || !data.paypal ? 'ltc' : 'paypal');
    }).catch(() => setMethods({bank: true, ltc: null, usdt: false, paypal: null}));
  }, []);
  // Offer "Trade now" first while someone is online; fall back to scheduling when nobody is (or everyone goes offline).
  const nowAvailable = (online ?? 0) > 0;
  useEffect(() => {
    if (online === null) return;
    if (mode === null) { setMode(nowAvailable ? 'now' : 'schedule'); if (nowAvailable && !touched) setRows([soonRow()]); }
    else if (mode === 'now' && !nowAvailable) setMode('schedule');
  }, [online, nowAvailable, mode, touched]);
  const asap = mode === 'now' && nowAvailable;
  const editRows = (next: Row[]) => { setTouched(true); setRows(next); };
  function choose(next: 'now' | 'schedule') {
    setMode(next);
    if (!touched) setRows([next === 'now' ? soonRow() : defaultRow(1)]);
  }

  async function placeOrder() {
    const built = buildTiming(asap, rows);
    if ('error' in built) { setError(built.error); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/orders', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({lines, method, timing: built.timing, redeemWheelCoins})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your order could not be placed.');
      save([]);
      invalidateJson('/api/auth/session', '/api/account', '/api/orders');
      window.dispatchEvent(new Event('jh-account-changed'));
      router.push(`/${locale}/orders/${data.code}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your order could not be placed.'); setBusy(false); }
  }

  if (!ready || !catalog.ready) return <LoadingRows label="Loading cart…"/>;
  if (account === null) return <p aria-busy="true">Checking account…</p>;
  if (account && account.role !== 'user') return <section className="card notice"><h1>Admin accounts cannot buy</h1><p>Sign out of Admin and use a customer account to place orders.</p></section>;
  if (!lines.length) return <div className="empty-state"><h1>No products to check out</h1><Link className="button" href={`/${locale}#catalog`}>Explore packages</Link></div>;
  const total = totalVnd(lines, products);
  const usd = formatUsdFromVnd(total, catalog.vndPerUsd);
  const noMethod = methods && !methods.bank && !methods.ltc && !methods.usdt && !methods.paypal;
  // PayPal charges the shop's fee on top, so the customer sees the exact USD (before the per-order cents on the next page).
  const paypalUsd = methods?.paypal ? formatUsdCents(paypalBaseCents(total, catalog.vndPerUsd, methods.paypal)) : usd;
  const paypalFee = methods?.paypal ? [methods.paypal.feePercent > 0 ? `${methods.paypal.feePercent}%` : '', methods.paypal.feeFixedCents > 0 ? formatUsdCents(methods.paypal.feeFixedCents) : ''].filter(Boolean).join(' + ') : '';
  const signedIn = Boolean(account && account.role === 'user');
  const wheelBalance = account && account.role === 'user' && /^\d+$/.test(account.coinBalance ?? '') ? BigInt(account.coinBalance!) : BigInt(0);

  return <>
    <div className="page-heading"><p className="eyebrow">CHECKOUT</p><h1>Review and place your order</h1><p className="muted checkout-lede">Pick when to trade, choose how to pay, place the order. Your price is held for {HOLD_MINUTES} minutes while you pay with the QR code; then we trade with you in the site chat.</p></div>
    <div className="checkout-layout">
      <div>
        <section className="card timing-card"><span className="eyebrow">01 / WHEN</span><h2>When do you want to trade?</h2>
          {mode === null ? <p aria-busy="true">Checking who is online…</p> : <>
            <div className="payment-options timing-options" role="radiogroup" aria-label="When to trade">
              <label className={`payment-option timing-option ${nowAvailable ? '' : 'disabled'}`}><input type="radio" name="timing" value="now" checked={asap} disabled={!nowAvailable} onChange={() => choose('now')}/>
                <span><span className="timing-title"><span className={`live-status-dot ${nowAvailable ? 'on' : ''}`} aria-hidden="true"/>Trade now</span>
                  <small>{nowAvailable ? `${online} trader${online === 1 ? '' : 's'} online · we start right after your payment is confirmed` : 'Nobody is online right now. Pick a time instead and we confirm it.'}</small></span></label>
              <label className="payment-option timing-option"><input type="radio" name="timing" value="schedule" checked={!asap} onChange={() => choose('schedule')}/>
                <span><span className="timing-title">Schedule a time</span><small>Pick 1–{MAX_SLOTS} times you are free; we confirm one of them</small></span></label>
            </div>
            {asap && <p className="asap-notice" role="note">{ASAP_NOTICE}</p>}
            <p className="field-caption">{asap ? 'Also free later today? Add a backup time in case the trader gets busy. ' : ''}Times are in your time zone ({browserTimeZone()}).</p>
            <SlotRows rows={rows} asap={asap} onChange={editRows}/>
          </>}
        </section>

        <section className="card" style={{marginTop: 20}}><span className="eyebrow">02 / PAYMENT METHOD</span><h2>How do you want to pay?</h2>
          {!methods ? <p aria-busy="true">Checking payment options…</p> : <div className="payment-options">
            {methods.usdt && <label className="payment-option"><input type="radio" name="method" value="usdt" checked={method === 'usdt'} onChange={() => setMethod('usdt')}/><span>USDT · TRON (TRC20)<small>Send {usd} in USDT from any wallet or exchange · exact amount on the next page</small></span></label>}
            {methods.ltc && <label className="payment-option"><input type="radio" name="method" value="ltc" checked={method === 'ltc'} onChange={() => setMethod('ltc')}/><span>Litecoin (LTC)<small>About {formatLtcEstimate(total, methods.ltc.vndPerLtc)} · exact amount shown after you place the order</small></span></label>}
            {methods.paypal && <label className="payment-option"><input type="radio" name="method" value="paypal" checked={method === 'paypal'} onChange={() => setMethod('paypal')}/><span>PayPal · USD<small>Send {paypalUsd} with PayPal · QR code on the next page{paypalFee ? ` · includes ${paypalFee} PayPal fee` : ''}</small></span></label>}
            {methods.bank && <label className="payment-option"><input type="radio" name="method" value="bank" checked={method === 'bank'} onChange={() => setMethod('bank')}/><span>Bank transfer · VietQR<small>Charged as {formatVnd(total)} in any Vietnamese banking app</small></span></label>}
            {noMethod && <p className="error-text">Payments are not set up yet. Please contact the shop on Discord.</p>}
          </div>}
        </section>
        <section id="account" className="card checkout-account" style={{marginTop: 20}}><span className="eyebrow">03 / ACCOUNT</span>
          {account ? <><h2>Signed in as {account.name}</h2><p className="muted">Order updates go to the email on your account and to your <Link href={`/${locale}/inbox`}>Inbox</Link>.</p></>
            : <CheckoutSignIn locale={locale} onSignedIn={() => {invalidateJson('/api/auth/session'); void loadAccount(true);}}/>}
        </section>
        {account && account.role === 'user' && <section className="card checkout-coins" style={{marginTop: 20}}><span className="eyebrow">04 / WHEEL COINS</span><h2>Receive your wheel winnings with this order?</h2>
          {wheelBalance > BigInt(0) ? <label className="wheel-coin-option"><input type="checkbox" checked={redeemWheelCoins} onChange={event => setRedeemWheelCoins(event.target.checked)}/><span><strong>Receive all {formatCoins(wheelBalance)}</strong><small>The balance is reserved now. Your Admin will add it to the package amount when delivering this order. It is returned automatically if this unpaid order is cancelled or expires.</small></span></label>
            : <p className="muted">Your wheel balance is empty. Paid orders unlock spins; spin first, then apply the winnings to a later order.</p>}
        </section>}
      </div>
      <aside className="card order-summary">
        <h2>Your order</h2>
        {lines.map((line, index) => {
          const product = products.find(item => item.id === line.productId);
          if (!product) return null;
          return <div className="summary-line" key={`${line.productId}-${index}`}><span>{product.title[locale]} × {line.quantity}</span><span className="summary-amount"><strong>{formatUsdFromVnd(product.priceVnd * line.quantity, catalog.vndPerUsd)}</strong><small>{formatVnd(product.priceVnd * line.quantity)}</small></span></div>;
        })}
        <div className="summary-total"><small>{method === 'usdt' ? 'You pay in USDT (TRC20)' : method === 'ltc' ? 'Order value (paid in LTC)' : method === 'paypal' ? `You pay with PayPal${paypalFee ? ` (includes ${paypalFee} PayPal fee)` : ''}` : 'You pay by bank transfer'}</small><p className="pay-amount">{method === 'paypal' ? paypalUsd : usd}</p><small className="pay-secondary">{formatVnd(total)}{methods?.ltc ? ` · ≈ ${formatLtcEstimate(total, methods.ltc.vndPerLtc)}` : ''}</small></div>
        {redeemWheelCoins && wheelBalance > BigInt(0) && <p className="summary-wheel-coins"><span>Wheel coins to receive</span><strong>+ {formatCoins(wheelBalance)}</strong></p>}
        {mode !== null && <p className="summary-timing">{asap ? <><span className="live-status-dot on" aria-hidden="true"/> Trade now, right after payment</> : <>Scheduled · {rows.length} time{rows.length === 1 ? '' : 's'} chosen</>}</p>}
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="full-width" type="button" disabled={busy || !signedIn || !methods || Boolean(noMethod) || mode === null} onClick={() => void placeOrder()}>{busy ? 'Placing order…' : 'Place order →'}</button>
        <p className="field-caption">{signedIn ? `You will see the ${method === 'bank' ? 'bank details' : method === 'paypal' ? 'PayPal link' : 'wallet address'} and QR code on the next page.` : <><a href="#account">Sign in or create an account</a> (step 03, takes a few seconds) to place your order.</>}</p>
      </aside>
    </div>
  </>;
}
