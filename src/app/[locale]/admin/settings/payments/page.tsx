'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {formatUsdFromVnd} from '@/lib/money';

type Account = {id: string; bankBin: string; bankName: string; accountNumber: string; accountHolder: string; active: boolean};
type State = {vndPerUsd: number; accounts: Account[]; banks: readonly {bin: string; name: string}[]};
type Draft = {id?: string; bankBin: string; customBin: string; accountNumber: string; accountHolder: string; active: boolean};
const emptyDraft: Draft = {bankBin: '970436', customBin: '', accountNumber: '', accountHolder: '', active: true};

export default function PaymentSettings() {
  const locale = useLocale();
  const [state, setState] = useState<State | null>(null);
  const [rate, setRate] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [qr, setQr] = useState<{id: string; svg: string} | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings/payments', {cache: 'no-store'}).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body); setRate(String(body.vndPerUsd)); })
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
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / PAYMENTS</p><h1>Payments</h1><p className="admin-lede">Customers transfer VND to an active account using a VietQR code. With several active accounts, orders rotate between them.</p></div></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}

    <section className="card admin-panel"><h2>Bank accounts</h2>
      {state.accounts.length === 0 ? <p className="admin-empty">No bank account yet. Customers cannot place orders until one is active.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Bank</th><th>Account</th><th>Holder</th><th>Status</th><th/></tr></thead><tbody>{state.accounts.map(account => <tr key={account.id}>
        <td>{account.bankName}<small className="admin-subtle"> · BIN {account.bankBin}</small></td><td className="admin-mono">{account.accountNumber}</td><td>{account.accountHolder}</td>
        <td><span className={`badge ${account.active ? 'ok' : ''}`}>{account.active ? 'Active' : 'Off'}</span></td>
        <td className="row-actions"><button type="button" className="secondary" onClick={() => setDraft({id: account.id, bankBin: state.banks.some(bank => bank.bin === account.bankBin) ? account.bankBin : 'other', customBin: account.bankBin, accountNumber: account.accountNumber, accountHolder: account.accountHolder, active: account.active})}>Edit</button><button type="button" className="secondary" disabled={busy} onClick={() => void post({action: 'test-qr', id: account.id}, '').then(data => data?.qrSvg && setQr({id: account.id, svg: data.qrSvg}))}>Test QR</button><button type="button" className="admin-remove-link" disabled={busy} onClick={() => { if (window.confirm(`Remove ${account.bankName} ${account.accountNumber}? Existing orders keep their copy of the details.`)) void post({action: 'delete-account', id: account.id}, 'Bank account removed.'); }}>Remove</button></td>
      </tr>)}</tbody></table></div>}
      {qr && <div className="test-qr"><img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.svg)}`} alt="Test VietQR code for 10,000 VND"/><div><strong>Test before going live</strong><p className="field-caption">Scan with your banking app. It should show your bank, account holder, 10.000 ₫ and the note “JH TEST”. You do not need to complete the transfer.</p><button type="button" className="secondary" onClick={() => setQr(null)}>Close</button></div></div>}

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

    <section className="card admin-panel"><h2>USD display rate</h2>
      <p className="field-caption">Prices are charged in VND. The store also shows USD using this rate. Example: 50.000 ₫ ≈ {formatUsdFromVnd(50000, Number(rate) || state.vndPerUsd)}.</p>
      <form className="rate-form" onSubmit={event => {event.preventDefault(); void post({action: 'rate', vndPerUsd: Number(rate)}, 'Rate saved. The store shows new USD prices within a minute.');}}>
        <label>VND per 1 USD<input type="number" min="1000" max="1000000" step="1" value={rate} onChange={event => setRate(event.target.value)} required/></label>
        <button type="submit" disabled={busy}>Save rate</button>
      </form>
    </section>
  </div>;
}
