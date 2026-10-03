'use client';
import {useEffect, useRef, useState} from 'react';
import {ASAP_NOTICE, MAX_SLOTS} from '@/lib/order-rules';
import {browserTimeZone, buildTiming, defaultRow, SlotRows, soonRow, type Row} from './time-picker';

/** Lets the customer propose 1–5 free time windows, entered in their own time zone. */
export default function TimeSlotsDialog({open, title, submitLabel, askTxid = false, onClose, onSubmit}: {open: boolean; title: string; submitLabel: string; askTxid?: boolean; onClose: () => void; onSubmit: (input: {timeZone: string; slots: {start: string; end: string}[]; txid?: string; asap?: boolean}) => Promise<string | null>}) {
  const [rows, setRows] = useState<Row[]>([defaultRow(1)]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [txid, setTxid] = useState('');
  const [asap, setAsap] = useState(false);
  const [touched, setTouched] = useState(false);
  const editRows = (next: Row[]) => { setTouched(true); setRows(next); };
  const dialog = useRef<HTMLDialogElement>(null);
  const timeZone = browserTimeZone();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) { setError(''); element.showModal(); }
    if (!open && element.open) element.close();
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const built = buildTiming(asap, rows);
    if ('error' in built) { setError(built.error); return; }
    if (askTxid && txid.trim() && !/^[0-9a-fA-F]{64}$/.test(txid.trim())) { setError('The transaction ID is 64 characters (0-9, a-f). Leave it empty if you do not have it.'); return; }
    setBusy(true); setError('');
    const failure = await onSubmit({...built.timing, ...(askTxid && txid.trim() ? {txid: txid.trim()} : {})});
    setBusy(false);
    if (failure) setError(failure);
  }

  return <dialog ref={dialog} className="slots-dialog" aria-labelledby="slots-title" onClose={onClose} onCancel={onClose}>
    <form onSubmit={event => void submit(event)}>
      <h2 id="slots-title">{title}</h2>
      {askTxid && <label className="txid-field">Transaction ID (optional)<input value={txid} onChange={event => setTxid(event.target.value)} placeholder="64-character TXID from your wallet" autoComplete="off" spellCheck={false}/><small>Helps us find your payment faster.</small></label>}
      <label className="asap-option"><input type="checkbox" checked={asap} onChange={event => {
        setAsap(event.target.checked);
        // Suggest a time later today, unless the customer already chose their own times.
        if (event.target.checked && !touched) setRows([soonRow()]);
      }}/><span><strong>I’m free right now</strong><small>Start as soon as an Admin is available. We will message you in Chat.</small></span></label>
      {asap && <p className="asap-notice" role="alert">{ASAP_NOTICE}</p>}
      <p className="field-caption">{asap ? 'More times you are free, in case we cannot start right away. ' : ''}Add 1–{asap ? MAX_SLOTS - 1 : MAX_SLOTS} times when you are free to receive your order (your time zone: {timeZone}). We will confirm one of them.</p>
      <SlotRows rows={rows} asap={asap} onChange={editRows}/>
      <p className="slots-final-note"><strong>Please choose carefully.</strong> After you pay and book, an Admin will pick a free time inside the windows you choose to complete the transaction. Once booked, it cannot be undone or changed.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Sending…' : submitLabel}</button></div>
    </form>
  </dialog>;
}
