'use client';
import {useEffect, useRef, useState} from 'react';
import {ASAP_NOTICE, asapProblem, MAX_SLOTS, slotProblem} from '@/lib/order-rules';

type Row = {date: string; from: string; to: string};

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
function defaultRow(offsetDays = 1): Row {
  const date = new Date(); date.setDate(date.getDate() + offsetDays);
  return {date: localDate(date), from: '19:00', to: '21:00'};
}
/** About two hours from now, on the half hour, for two hours: today's suggestion when the customer is free right now. */
function soonRow(): Row {
  const start = new Date(Date.now() + 2 * 60 * 60_000);
  start.setMinutes(start.getMinutes() <= 30 ? 30 : 60, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  if (localDate(end) !== localDate(new Date()) || localDate(start) !== localDate(new Date())) return defaultRow(1);
  return {date: localDate(start), from: `${pad(start.getHours())}:${pad(start.getMinutes())}`, to: `${pad(end.getHours())}:${pad(end.getMinutes())}`};
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
  const [touched, setTouched] = useState(false);
  const editRows = (next: Row[]) => { setTouched(true); setRows(next); };
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
    const filled = rows;
    if (filled.some(row => !row.date || !row.from || !row.to)) { setError('Fill in the date and both times for every row.'); return; }
    if (filled.some(row => row.to <= row.from)) { setError('Each end time must be after its start time (same day).'); return; }
    const slots = [...(asap ? [nowSlot] : []), ...filled.map(toSlot)].slice(0, MAX_SLOTS);
    const problem = slotProblem(slots) ?? asapProblem(asap, slots);
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
      <label className="asap-option"><input type="checkbox" checked={asap} onChange={event => {
        setAsap(event.target.checked);
        // Suggest a time later today, unless the customer already chose their own times.
        if (event.target.checked && !touched) setRows([soonRow()]);
      }}/><span><strong>I’m free right now</strong><small>Start as soon as an Admin is available. We will message you in Chat.</small></span></label>
      {asap && <p className="asap-notice" role="alert">{ASAP_NOTICE}</p>}
      <p className="field-caption">{asap ? 'More times you are free, in case we cannot start right away. ' : ''}Add 1–{asap ? MAX_SLOTS - 1 : MAX_SLOTS} times when you are free to receive your order (your time zone: {timeZone}). We will confirm one of them.</p>
      <><div className="slot-rows">{rows.map((row, index) => <fieldset className="slot-row" key={index}>
        <legend>Time {index + 1}</legend>
        <label>Date<input type="date" required value={row.date} min={localDate(new Date())} onChange={event => editRows(rows.map((item, i) => i === index ? {...item, date: event.target.value} : item))}/></label>
        <label>From<input type="time" required value={row.from} onChange={event => editRows(rows.map((item, i) => i === index ? {...item, from: event.target.value} : item))}/></label>
        <label>To<input type="time" required value={row.to} onChange={event => editRows(rows.map((item, i) => i === index ? {...item, to: event.target.value} : item))}/></label>
        {rows.length > 1 && <button type="button" className="admin-remove-link" onClick={() => editRows(rows.filter((_, i) => i !== index))}>Remove</button>}
      </fieldset>)}</div>
      {rows.length < MAX_SLOTS - (asap ? 1 : 0) && <button type="button" className="secondary" onClick={() => editRows([...rows, defaultRow(rows.length + 1)])}>+ Add another time</button>}</>
      <p className="slots-final-note"><strong>Please choose carefully.</strong> After you pay and book, an Admin will pick a free time inside the windows you choose to complete the transaction. Once booked, it cannot be undone or changed.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Sending…' : submitLabel}</button></div>
    </form>
  </dialog>;
}
