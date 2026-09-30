'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {formatUsdFromVnd} from '@/lib/money';

type Account = {id: string; bankBin: string; bankName: string; accountNumber: string; accountHolder: string; active: boolean};
type Wallet = {id: string; address: string; label: string; active: boolean};
type State = {vndPerUsd: number; accounts: Account[]; banks: readonly {bin: string; name: string}[]; wallets: Wallet[]; ltcOverride: number | null; ltcRate: {vndPerLtc: number; source: string} | null};
type WalletDraft = {id?: string; address: string; label: string; active: boolean};
const emptyWallet: WalletDraft = {address: '', label: '', active: true};
type Draft = {id?: string; bankBin: string; customBin: string; accountNumber: string; accountHolder: string; active: boolean};
const emptyDraft: Draft = {bankBin: '970436', customBin: '', accountNumber: '', accountHolder: '', active: true};

export default function PaymentSettings() {
  const locale = useLocale();
  const [state, setState] = useState<State | null>(null);
  const [rate, setRate] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [wallet, setWallet] = useState<WalletDraft>(emptyWallet);
  const [override, setOverride] = useState('');
  const [qr, setQr] = useState<{id: string; svg: string} | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings/payments', {cache: 'no-store'}).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body); setRate(String(body.vndPerUsd)); setOverride(body.ltcOverride ? String(body.ltcOverride) : ''); })
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

  if (!state) return <div className="page-heading"><Link href={`/${locale}/admin/settings`}>← Settings</Link>{error ? <p className="admin-feedback error" role="alert">{error}</p> : <p className="muted" role="status">Loading…</p>}</div>;
  const bin = draft.bankBin === 'other' ? draft.customBin : draft.bankBin;
  return <div className="admin-payments-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / PAYMENTS</p><h1>Payments</h1><p className="admin-lede">Customers pay by VietQR bank transfer (VND) or Litecoin. With several active accounts or wallets, orders rotate between them.</p></div></div>
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

    <section className="card admin-panel"><h2>Litecoin wallets</h2>
      <p className="field-caption">Customers can also pay in Litecoin (LTC). Each order gets its own LTC amount (the last digits differ). The site watches the Litecoin network and marks an order paid by itself after 2 confirmations (about 5 minutes); customers may also paste their transaction ID.</p>
      {state.wallets.length === 0 ? <p className="admin-empty">No Litecoin wallet: checkout offers bank transfer only.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Label</th><th>Address</th><th>Status</th><th/></tr></thead><tbody>{state.wallets.map(item => <tr key={item.id}>
        <td>{item.label}</td><td className="admin-mono">{item.address}</td>
        <td><span className={`badge ${item.active ? 'ok' : ''}`}>{item.active ? 'Active' : 'Off'}</span></td>
        <td className="row-actions"><button type="button" className="secondary" onClick={() => setWallet({id: item.id, address: item.address, label: item.label, active: item.active})}>Edit</button><button type="button" className="secondary" disabled={busy} onClick={() => void post({action: 'test-wallet-qr', id: item.id}, '').then(data => data?.qrSvg && setQr({id: item.id, svg: data.qrSvg}))}>Test QR</button><a className="button secondary" href={`https://litecoinspace.org/address/${item.address}`} target="_blank" rel="noreferrer">Explorer</a><button type="button" className="admin-remove-link" disabled={busy} onClick={() => { if (window.confirm(`Remove wallet ${item.label}? Existing orders keep their copy of the address.`)) void post({action: 'delete-wallet', id: item.id}, 'Wallet removed.'); }}>Remove</button></td>
      </tr>)}</tbody></table></div>}
      {qr && state.wallets.some(item => item.id === qr.id) && <div className="test-qr"><img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.svg)}`} alt="Test Litecoin QR code for 0.001 LTC"/><div><strong>Test before going live</strong><p className="field-caption">Scan with your Litecoin wallet app (Send → scan). It should fill in this address and 0.001 LTC. You do not need to send it.</p><button type="button" className="secondary" onClick={() => setQr(null)}>Close</button></div></div>}
      <h3>{wallet.id ? 'Edit wallet' : 'Add a wallet'}</h3>
      <form className="bank-form" onSubmit={event => {event.preventDefault(); void post({action: 'save-wallet', ...(wallet.id ? {id: wallet.id} : {}), address: wallet.address.trim(), label: wallet.label, active: wallet.active}, wallet.id ? 'Wallet updated.' : 'Wallet added. Scan the Test QR with your wallet app to double-check.').then(data => data && setWallet(emptyWallet));}}>
        <div className="admin-field-row">
          <label>Litecoin address<input className="admin-mono" value={wallet.address} required placeholder="ltc1… / L… / M…" onChange={event => setWallet({...wallet, address: event.target.value})}/><small>Copy it from your wallet’s Receive screen. The checksum is verified.</small></label>
          <label>Label<input value={wallet.label} maxLength={60} placeholder="e.g. Trust Wallet" onChange={event => setWallet({...wallet, label: event.target.value})}/></label>
        </div>
        <label className="admin-compact-check"><input type="checkbox" checked={wallet.active} onChange={event => setWallet({...wallet, active: event.target.checked})}/> Active (offered at checkout)</label>
        <div className="form-actions"><button type="submit" disabled={busy}>{wallet.id ? 'Save wallet' : 'Add wallet'}</button>{wallet.id && <button type="button" className="secondary" onClick={() => setWallet(emptyWallet)}>Cancel edit</button>}</div>
      </form>
    </section>

    <section className="card admin-panel"><h2>Litecoin price</h2>
      <p className="field-caption">Current price used for new orders: <strong>{state.ltcRate ? `${state.ltcRate.vndPerLtc.toLocaleString('vi-VN')} ₫ per LTC` : 'unavailable'}</strong>{state.ltcRate ? ` (${state.ltcRate.source === 'manual' ? 'set manually' : `market price from ${state.ltcRate.source === 'coingecko' ? 'CoinGecko' : 'Binance'}`})` : ''}. The price is locked for each order during its 30-minute payment window.</p>
      <form className="rate-form" onSubmit={event => {event.preventDefault(); void post({action: 'ltc-override', vndPerLtc: override.trim() ? Number(override) : null}, override.trim() ? 'Manual Litecoin price saved.' : 'Litecoin price is automatic again.');}}>
        <label>Manual price (VND per 1 LTC)<input type="number" min="1000" step="1" value={override} onChange={event => setOverride(event.target.value)} placeholder="Leave empty for automatic"/></label>
        <button type="submit" disabled={busy}>Save price</button>
      </form>
    </section>

    <section className="card admin-panel"><h2>USD display rate</h2>
      <p className="field-caption">Prices are charged in VND. The store also shows USD using this rate. Example: 50.000 ₫ ≈ {formatUsdFromVnd(50000, Number(rate) || state.vndPerUsd)}.</p>
      <form className="rate-form" onSubmit={event => {event.preventDefault(); void post({action: 'rate', vndPerUsd: Number(rate)}, 'Rate saved. The store shows new USD prices within a minute.');}}>
        <label>VND per 1 USD<input type="number" min="1000" max="1000000" step="1" value={rate} onChange={event => setRate(event.target.value)} required/></label>
        <button type="submit" disabled={busy}>Save rate</button>
      </form>
    </section>
  </div>;
}
