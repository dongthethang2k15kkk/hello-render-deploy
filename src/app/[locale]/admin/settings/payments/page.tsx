'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {formatUsdFromVnd} from '@/lib/money';
import {LoadingRows} from '@/components/loading-state';
import type {PaypalSettings} from '@/lib/paypal';

type Account = {id: string; bankBin: string; bankName: string; accountNumber: string; accountHolder: string; active: boolean};
type Wallet = {id: string; network: string; address: string; label: string; active: boolean};
const networkLabel = (network: string) => network === 'TRC20' ? 'USDT · TRC20' : 'Litecoin';
const walletExplorer = (wallet: {network: string; address: string}) => wallet.network === 'TRC20' ? `https://tronscan.org/#/address/${wallet.address}` : `https://litecoinspace.org/address/${wallet.address}`;
type Mode = 'auto' | 'fixed';
type UsdRate = {vndPerUsd: number; source: string; updatedAt: string | null};
type LtcRate = {vndPerLtc: number; source: string; updatedAt: string | null};
type Rates = {usdMode: Mode; usdFixed: number; ltcMode: Mode; ltcFixed: number | null; usdRate: UsdRate; ltcRate: LtcRate | null; market: {usd: UsdRate | null; ltc: LtcRate | null}};
type State = {accounts: Account[]; banks: readonly {bin: string; name: string}[]; wallets: Wallet[]; paypal: PaypalSettings; rates: Rates};
type PaypalDraft = {enabled: boolean; username: string; email: string; feePercent: string; feeFixed: string; instructions: string};
const paypalDraft = (saved: PaypalSettings): PaypalDraft => ({enabled: saved.enabled, username: saved.username, email: saved.email ?? '', feePercent: String(saved.feePercent), feeFixed: (saved.feeFixedCents / 100).toFixed(2), instructions: saved.instructions});

const providers: Record<string, string> = {'currency-api': 'currency-api (daily market rate)', coinbase: 'Coinbase', coingecko: 'CoinGecko', kraken: 'Kraken', binance: 'Binance'};
/** "live from CoinGecko, updated 16:42" / "fixed by an Admin" / "fixed rate, because no market rate could be fetched". */
function rateSource(rate: {source: string; updatedAt: string | null}) {
  if (rate.source === 'fixed') return 'fixed by an Admin';
  if (rate.source === 'fallback') return 'the fixed rate below, because no market rate could be fetched right now';
  return `live from ${providers[rate.source] ?? rate.source}${rate.updatedAt ? `, checked ${new Date(rate.updatedAt).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}` : ''}`;
}
type WalletDraft = {id?: string; network: 'LTC' | 'TRC20'; address: string; label: string; active: boolean};
const emptyWallet: WalletDraft = {network: 'LTC', address: '', label: '', active: true};
type Draft = {id?: string; bankBin: string; customBin: string; accountNumber: string; accountHolder: string; active: boolean};
const emptyDraft: Draft = {bankBin: '970436', customBin: '', accountNumber: '', accountHolder: '', active: true};

export default function PaymentSettings() {
  const locale = useLocale();
  const [state, setState] = useState<State | null>(null);
  const [usdMode, setUsdMode] = useState<Mode>('auto');
  const [rate, setRate] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [wallet, setWallet] = useState<WalletDraft>(emptyWallet);
  const [ltcMode, setLtcMode] = useState<Mode>('auto');
  const [ltcFixed, setLtcFixed] = useState('');
  const [qr, setQr] = useState<{id: string; svg: string} | null>(null);
  const [paypal, setPaypal] = useState<PaypalDraft | null>(null);
  const [paypalQr, setPaypalQr] = useState<{svg: string; link: string} | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings/payments', {cache: 'no-store'}).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body); setUsdMode(body.rates.usdMode); setRate(String(body.rates.usdFixed)); setLtcMode(body.rates.ltcMode); setLtcFixed(body.rates.ltcFixed ? String(body.rates.ltcFixed) : ''); setPaypal(paypalDraft(body.paypal)); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Payment settings could not be loaded.'));
  }, []);

  async function post(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/settings/payments', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.qrSvg) return data;
      setState(data); setMessage(success);
      return data;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The settings could not be saved.'); return null; }
    finally { setBusy(false); }
  }

  if (!state) return <div className="page-heading"><Link href={`/${locale}/admin/settings`}>← Settings</Link>{error ? <p className="admin-feedback error" role="alert">{error}</p> : <LoadingRows label="Loading…"/>}</div>;
  const bin = draft.bankBin === 'other' ? draft.customBin : draft.bankBin;
  return <div className="admin-payments-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / PAYMENTS</p><h1>Payments</h1><p className="admin-lede">Customers pay by VietQR bank transfer (VND), Litecoin, USDT or PayPal. With several active accounts or wallets, orders rotate between them.</p></div></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}

    <section className="card admin-panel"><h2>Bank accounts</h2>
      {state.accounts.length === 0 ? <p className="admin-empty">No bank account yet. Customers cannot place orders until one is active.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Bank</th><th>Account</th><th>Holder</th><th>Status</th><th/></tr></thead><tbody>{state.accounts.map(account => <tr key={account.id}>
        <td>{account.bankName}<small className="admin-subtle"> · BIN {account.bankBin}</small></td><td className="admin-mono">{account.accountNumber}</td><td>{account.accountHolder}</td>
        <td><span className={`badge ${account.active ? 'ok' : ''}`}>{account.active ? 'Active' : 'Off'}</span></td>
        <td className="row-actions"><button type="button" className="secondary" onClick={() => setDraft({id: account.id, bankBin: state.banks.some(bank => bank.bin === account.bankBin) ? account.bankBin : 'other', customBin: account.bankBin, accountNumber: account.accountNumber, accountHolder: account.accountHolder, active: account.active})}>Edit</button><button type="button" className="secondary" disabled={busy} onClick={() => void post({action: 'test-qr', id: account.id}, '').then(data => data?.qrSvg && setQr({id: account.id, svg: data.qrSvg}))}>Test QR</button><button type="button" className="admin-remove-link" disabled={busy} onClick={() => { if (window.confirm(`Remove ${account.bankName} ${account.accountNumber}? Existing orders keep their copy of the details.`)) void post({action: 'delete-account', id: account.id}, 'Bank account removed.'); }}>Remove</button></td>
      </tr>)}</tbody></table></div>}
      {qr && state.accounts.some(item => item.id === qr.id) && <div className="test-qr"><img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.svg)}`} alt="Test VietQR code for 10,000 VND"/><div><strong>Test before going live</strong><p className="field-caption">Scan with your banking app. It should show your bank, account holder, 10.000 ₫ and the note “JH TEST”. You do not need to complete the transfer.</p><button type="button" className="secondary" onClick={() => setQr(null)}>Close</button></div></div>}

      <h3>{draft.id ? 'Edit account' : 'Add an account'}</h3>
      <form className="bank-form" onSubmit={event => {event.preventDefault(); void post({action: 'save-account', ...(draft.id ? {id: draft.id} : {}), bankBin: bin, accountNumber: draft.accountNumber.trim(), accountHolder: draft.accountHolder, active: draft.active}, draft.id ? 'Bank account updated.' : 'Bank account added.').then(data => data && setDraft(emptyDraft));}}>
        <div className="admin-field-row">
          <label>Bank<select value={draft.bankBin} onChange={event => setDraft({...draft, bankBin: event.target.value})}>{state.banks.map(bank => <option key={bank.bin} value={bank.bin}>{bank.name}</option>)}<option value="other">Other (enter BIN)</option></select></label>
          {draft.bankBin === 'other' && <label>Bank BIN (6 digits)<input value={draft.customBin} inputMode="numeric" pattern="\d{6}" required onChange={event => setDraft({...draft, customBin: event.target.value})}/></label>}
          <label>Account number<input value={draft.accountNumber} required pattern="[0-9A-Za-z]{4,19}" onChange={event => setDraft({...draft, accountNumber: event.target.value})}/></label>
          <label>Account holder<input value={draft.accountHolder} required placeholder="NGUYEN VAN A" onChange={event => setDraft({...draft, accountHolder: event.target.value})}/><small>Saved in capitals without accents, as banks show it.</small></label>
        </div>
        <label className="admin-compact-check"><input type="checkbox" checked={draft.active} onChange={event => setDraft({...draft, active: event.target.checked})}/> Active (shown to customers)</label>
        <div className="form-actions"><button type="submit" disabled={busy}>{draft.id ? 'Save account' : 'Add account'}</button>{draft.id && <button type="button" className="secondary" onClick={() => setDraft(emptyDraft)}>Cancel edit</button>}</div>
      </form>
    </section>

    <section className="card admin-panel"><h2>Crypto wallets</h2><p className="field-caption">Litecoin and USDT on TRON (TRC20). Each order gets its own exact amount, and the site watches the blockchain and confirms the payment by itself.</p>
      <p className="field-caption">Customers can also pay in Litecoin (LTC). Each order gets its own LTC amount (the last digits differ). The site watches the Litecoin network and marks an order paid by itself after 2 confirmations (about 5 minutes); customers may also paste their transaction ID.</p>
      {state.wallets.length === 0 ? <p className="admin-empty">No crypto wallet: checkout offers bank transfer only.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Label</th><th>Network</th><th>Address</th><th>Status</th><th/></tr></thead><tbody>{state.wallets.map(item => <tr key={item.id}>
        <td>{item.label}</td><td>{networkLabel(item.network)}</td><td className="admin-mono">{item.address}</td>
        <td><span className={`badge ${item.active ? 'ok' : ''}`}>{item.active ? 'Active' : 'Off'}</span></td>
        <td className="row-actions"><button type="button" className="secondary" onClick={() => setWallet({id: item.id, network: item.network === 'TRC20' ? 'TRC20' : 'LTC', address: item.address, label: item.label, active: item.active})}>Edit</button><button type="button" className="secondary" disabled={busy} onClick={() => void post({action: 'test-wallet-qr', id: item.id}, '').then(data => data?.qrSvg && setQr({id: item.id, svg: data.qrSvg}))}>Test QR</button><a className="button secondary" href={walletExplorer(item)} target="_blank" rel="noreferrer">Explorer</a><button type="button" className="admin-remove-link" disabled={busy} onClick={() => { if (window.confirm(`Remove wallet ${item.label}? Existing orders keep their copy of the address.`)) void post({action: 'delete-wallet', id: item.id}, 'Wallet removed.'); }}>Remove</button></td>
      </tr>)}</tbody></table></div>}
      {qr && state.wallets.some(item => item.id === qr.id) && <div className="test-qr"><img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.svg)}`} alt="Test Litecoin QR code for 0.001 LTC"/><div><strong>Test before going live</strong><p className="field-caption">Scan with your Litecoin wallet app (Send → scan). It should fill in this address and 0.001 LTC. You do not need to send it.</p><button type="button" className="secondary" onClick={() => setQr(null)}>Close</button></div></div>}
      <h3>{wallet.id ? 'Edit wallet' : 'Add a wallet'}</h3>
      <form className="bank-form" onSubmit={event => {event.preventDefault(); void post({action: 'save-wallet', ...(wallet.id ? {id: wallet.id} : {}), network: wallet.network, address: wallet.address.trim(), label: wallet.label, active: wallet.active}, wallet.id ? 'Wallet updated.' : 'Wallet added. Scan the Test QR with your wallet app to double-check.').then(data => data && setWallet(emptyWallet));}}>
        <div className="admin-field-row">
          <label>Network<select value={wallet.network} onChange={event => setWallet({...wallet, network: event.target.value as WalletDraft['network']})}><option value="LTC">Litecoin (LTC)</option><option value="TRC20">USDT on TRON (TRC20)</option></select></label>
          <label>{wallet.network === 'TRC20' ? 'TRON address (USDT)' : 'Litecoin address'}<input className="admin-mono" value={wallet.address} required placeholder={wallet.network === 'TRC20' ? 'T…' : 'ltc1… / L… / M…'} onChange={event => setWallet({...wallet, address: event.target.value})}/><small>Copy it from your wallet’s Receive screen. The checksum is verified.</small></label>
          <label>Label<input value={wallet.label} maxLength={60} placeholder="e.g. Trust Wallet" onChange={event => setWallet({...wallet, label: event.target.value})}/></label>
        </div>
        <label className="admin-compact-check"><input type="checkbox" checked={wallet.active} onChange={event => setWallet({...wallet, active: event.target.checked})}/> Active (offered at checkout)</label>
        <div className="form-actions"><button type="submit" disabled={busy}>{wallet.id ? 'Save wallet' : 'Add wallet'}</button>{wallet.id && <button type="button" className="secondary" onClick={() => setWallet(emptyWallet)}>Cancel edit</button>}</div>
      </form>
    </section>

    {paypal && <section className="card admin-panel"><h2>PayPal</h2>
      <p className="field-caption">Customers get a PayPal.me link and QR code with their exact USD amount filled in; each order gets its own cents. PayPal does not report payments to the site, so <strong>you confirm each PayPal order yourself</strong> after checking your PayPal account, like a bank transfer.</p>
      <form className="bank-form" onSubmit={event => {event.preventDefault(); void post({action: 'save-paypal', enabled: paypal.enabled, username: paypal.username, email: paypal.email, feePercent: Number(paypal.feePercent) || 0, feeFixedCents: Math.round((Number(paypal.feeFixed) || 0) * 100), instructions: paypal.instructions}, paypal.enabled ? 'PayPal is on. Press Test QR to check the link before customers use it.' : 'PayPal settings saved (PayPal is off).').then(data => data && setPaypal(paypalDraft(data.paypal)));}}>
        <label className="admin-compact-check"><input type="checkbox" checked={paypal.enabled} onChange={event => setPaypal({...paypal, enabled: event.target.checked})}/> Offer PayPal at checkout</label>
        <div className="admin-field-row">
          <label>PayPal.me name<input className="admin-mono" value={paypal.username} maxLength={200} placeholder="yourname" onChange={event => setPaypal({...paypal, username: event.target.value})}/><small>The part after paypal.me/ (you can paste the whole link).</small></label>
          <label>PayPal email (optional)<input type="email" value={paypal.email} maxLength={120} placeholder="shown to customers who prefer to send by hand" onChange={event => setPaypal({...paypal, email: event.target.value})}/></label>
        </div>
        <div className="admin-field-row">
          <label>Fee added to PayPal orders (%)<input type="number" min="0" max="15" step="0.1" value={paypal.feePercent} onChange={event => setPaypal({...paypal, feePercent: event.target.value})}/><small>0 to 15. Customers see it at checkout.</small></label>
          <label>Fixed fee (USD)<input type="number" min="0" max="5" step="0.01" value={paypal.feeFixed} onChange={event => setPaypal({...paypal, feeFixed: event.target.value})}/><small>0 to 5.00, added on top of the percentage.</small></label>
        </div>
        <label>Instructions for customers (optional)<textarea rows={2} maxLength={500} value={paypal.instructions} placeholder="e.g. Send as Friends &amp; Family" onChange={event => setPaypal({...paypal, instructions: event.target.value})}/><small>Shown on the order page next to the QR code. {paypal.instructions.length}/500</small></label>
        <div className="form-actions"><button type="submit" disabled={busy}>Save PayPal</button><button type="button" className="secondary" disabled={busy} onClick={() => void post({action: 'test-paypal-qr', username: paypal.username}, '').then(data => data?.qrSvg && setPaypalQr({svg: data.qrSvg, link: data.link}))}>Test QR</button></div>
      </form>
      {paypalQr && <div className="test-qr"><img src={`data:image/svg+xml;utf8,${encodeURIComponent(paypalQr.svg)}`} alt="Test PayPal QR code for 1.00 USD"/><div><strong>Test before going live</strong><p className="field-caption">Scan with your phone camera, or open the link. PayPal should show a payment page to your name for $1.00 USD. You do not need to pay. If it shows a different amount or none, customers still see the exact amount on their order page and can copy it.</p><a className="button secondary" href={paypalQr.link} target="_blank" rel="noreferrer">Open test link</a> <button type="button" className="secondary" onClick={() => setPaypalQr(null)}>Close</button></div></div>}
    </section>}

    <section className="card admin-panel"><h2>Litecoin price</h2>
      <p className="field-caption">Used for new orders and the LTC estimates in the store: <strong>{state.rates.ltcRate ? `${state.rates.ltcRate.vndPerLtc.toLocaleString('vi-VN')} ₫ per LTC` : 'unavailable'}</strong>{state.rates.ltcRate ? ` (${rateSource(state.rates.ltcRate)})` : ' (no market price and no fixed price, so Litecoin checkout is paused)'}. Each order locks the price for its 30-minute payment window.</p>
      {state.rates.ltcMode === 'fixed' && state.rates.market.ltc && <p className="field-caption">Market price now: {state.rates.market.ltc.vndPerLtc.toLocaleString('vi-VN')} ₫ per LTC ({providers[state.rates.market.ltc.source] ?? state.rates.market.ltc.source}).</p>}
      <form className="rate-settings" onSubmit={event => {event.preventDefault(); void post({action: 'ltc-rate', mode: ltcMode, vndPerLtc: ltcFixed.trim() ? Number(ltcFixed) : null}, ltcMode === 'auto' ? 'Litecoin price follows the market.' : 'Fixed Litecoin price saved.');}}>
        <fieldset className="rate-mode"><legend>Price source</legend>
          <label><input type="radio" name="ltc-mode" checked={ltcMode === 'auto'} onChange={() => setLtcMode('auto')}/><span><strong>Automatic</strong><small>Follow the live market price (recommended)</small></span></label>
          <label><input type="radio" name="ltc-mode" checked={ltcMode === 'fixed'} onChange={() => setLtcMode('fixed')}/><span><strong>Fixed</strong><small>Always use the price below</small></span></label>
        </fieldset>
        <div className="rate-form">
          <label>{ltcMode === 'fixed' ? 'Fixed price' : 'Fallback price'} (VND per 1 LTC)<input type="number" min="1000" step="1" value={ltcFixed} onChange={event => setLtcFixed(event.target.value)} required={ltcMode === 'fixed'} placeholder={ltcMode === 'fixed' ? '' : 'Optional'}/><small className="field-caption">{ltcMode === 'fixed' ? 'Customers pay at exactly this price.' : 'Only used if no market price can be fetched.'}</small></label>
          <button type="submit" disabled={busy}>Save</button>
        </div>
      </form>
    </section>

    <section className="card admin-panel"><h2>USD rate</h2>
      <p className="field-caption">Prices are charged in VND; the store also shows USD. Now: <strong>{state.rates.usdRate.vndPerUsd.toLocaleString('vi-VN')} ₫ per USD</strong> ({rateSource(state.rates.usdRate)}). Example: 50.000 ₫ ≈ {formatUsdFromVnd(50000, usdMode === 'fixed' ? Number(rate) || state.rates.usdRate.vndPerUsd : state.rates.usdRate.vndPerUsd)}.</p>
      {state.rates.usdMode === 'fixed' && state.rates.market.usd && <p className="field-caption">Market rate now: {state.rates.market.usd.vndPerUsd.toLocaleString('vi-VN')} ₫ per USD.</p>}
      <form className="rate-settings" onSubmit={event => {event.preventDefault(); void post({action: 'rate', mode: usdMode, vndPerUsd: Number(rate)}, usdMode === 'auto' ? 'USD rate follows the market.' : 'Fixed USD rate saved.');}}>
        <fieldset className="rate-mode"><legend>Rate source</legend>
          <label><input type="radio" name="usd-mode" checked={usdMode === 'auto'} onChange={() => setUsdMode('auto')}/><span><strong>Automatic</strong><small>Follow the market rate, updated daily (recommended)</small></span></label>
          <label><input type="radio" name="usd-mode" checked={usdMode === 'fixed'} onChange={() => setUsdMode('fixed')}/><span><strong>Fixed</strong><small>Always use the rate below</small></span></label>
        </fieldset>
        <div className="rate-form">
          <label>{usdMode === 'fixed' ? 'Fixed rate' : 'Fallback rate'} (VND per 1 USD)<input type="number" min="1000" max="1000000" step="1" value={rate} onChange={event => setRate(event.target.value)} required/><small className="field-caption">{usdMode === 'fixed' ? 'The store converts USD with exactly this rate.' : 'Only used if no market rate can be fetched.'}</small></label>
          <button type="submit" disabled={busy}>Save</button>
        </div>
      </form>
    </section>
  </div>;
}
