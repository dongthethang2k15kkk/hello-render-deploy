'use client';
import {useEffect, useRef, useState} from 'react';
import {MAX_SLOTS, slotProblem} from '@/lib/order-rules';

type Row = {date: string; from: string; to: string};

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
function defaultRow(offsetDays = 1): Row {
  const date = new Date(); date.setDate(date.getDate() + offsetDays);
  return {date: localDate(date), from: '19:00', to: '21:00'};
}
/** Browser-local date + times to ISO instants. */
function toSlot(row: Row) {
  return {start: new Date(`${row.date}T${row.from}`).toISOString(), end: new Date(`${row.date}T${row.to}`).toISOString()};
}

/** Lets the customer propose 1–5 free time windows, entered in their own time zone. */
export default function TimeSlotsDialog({open, title, submitLabel, askTxid = false, onClose, onSubmit}: {open: boolean; title: string; submitLabel: string; askTxid?: boolean; onClose: () => void; onSubmit: (input: {timeZone: string; slots: {start: string; end: string}[]; txid?: string; asap?: boolean}) => Promise<string | null>}) {
  const [rows, setRows] = useState<Row[]>([defaultRow(1)]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [txid, setTxid] = useState('');
  const [asap, setAsap] = useState(false);
  const [later, setLater] = useState(false);
  const showRows = !asap || later;
  const dialog = useRef<HTMLDialogElement>(null);
  const timeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Ho_Chi_Minh';

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) { setError(''); element.showModal(); }
    if (!open && element.open) element.close();
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // "Right now" becomes a window starting now; extra rows stay as fallbacks if the shop is busy.
    const nowSlot = {start: new Date().toISOString(), end: new Date(Date.now() + 3 * 60 * 60_000).toISOString()};
    const filled = showRows ? rows : [];
    if (filled.some(row => !row.date || !row.from || !row.to)) { setError('Fill in the date and both times for every row.'); return; }
    if (filled.some(row => row.to <= row.from)) { setError('Each end time must be after its start time (same day).'); return; }
    const slots = [...(asap ? [nowSlot] : []), ...filled.map(toSlot)].slice(0, MAX_SLOTS);
    const problem = slotProblem(slots);
    if (problem) { setError(problem); return; }
    if (askTxid && txid.trim() && !/^[0-9a-fA-F]{64}$/.test(txid.trim())) { setError('The transaction ID is 64 characters (0-9, a-f). Leave it empty if you do not have it.'); return; }
    setBusy(true); setError('');
    const failure = await onSubmit({timeZone, slots, asap, ...(askTxid && txid.trim() ? {txid: txid.trim()} : {})});
    setBusy(false);
    if (failure) setError(failure);
  }

  return <dialog ref={dialog} className="slots-dialog" aria-labelledby="slots-title" onClose={onClose} onCancel={onClose}>
    <form onSubmit={event => void submit(event)}>
      <h2 id="slots-title">{title}</h2>
      {askTxid && <label className="txid-field">Litecoin transaction ID (optional)<input value={txid} onChange={event => setTxid(event.target.value)} placeholder="64-character TXID from your wallet" autoComplete="off" spellCheck={false}/><small>Helps us find your payment faster.</small></label>}
      <label className="asap-option"><input type="checkbox" checked={asap} onChange={event => setAsap(event.target.checked)}/><span><strong>I’m free right now</strong><small>Start as soon as an Admin is available. We will message you in Chat.</small></span></label>
      {asap && !later ? <button type="button" className="secondary" onClick={() => setLater(true)}>+ Also add later times, in case we are busy</button> : <p className="field-caption">{asap ? 'Later times, in case we cannot start right away. ' : ''}Add 1–{MAX_SLOTS} times when you are free to receive your order (your time zone: {timeZone}). We will confirm one of them.</p>}
      {showRows && <><div className="slot-rows">{rows.map((row, index) => <fieldset className="slot-row" key={index}>
        <legend>Time {index + 1}</legend>
        <label>Date<input type="date" required value={row.date} min={localDate(new Date())} onChange={event => setRows(rows.map((item, i) => i === index ? {...item, date: event.target.value} : item))}/></label>
        <label>From<input type="time" required value={row.from} onChange={event => setRows(rows.map((item, i) => i === index ? {...item, from: event.target.value} : item))}/></label>
        <label>To<input type="time" required value={row.to} onChange={event => setRows(rows.map((item, i) => i === index ? {...item, to: event.target.value} : item))}/></label>
        {rows.length > 1 && <button type="button" className="admin-remove-link" onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove</button>}
      </fieldset>)}</div>
      {rows.length < MAX_SLOTS - (asap ? 1 : 0) && <button type="button" className="secondary" onClick={() => setRows([...rows, defaultRow(rows.length + 1)])}>+ Add another time</button>}</>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Sending…' : submitLabel}</button></div>
    </form>
  </dialog>;
}
