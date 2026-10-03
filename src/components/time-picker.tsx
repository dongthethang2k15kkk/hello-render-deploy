'use client';
import {asapProblem, MAX_SLOTS, slotProblem} from '@/lib/order-rules';

export type Row = {date: string; from: string; to: string};
export type Timing = {timeZone: string; slots: {start: string; end: string}[]; asap: boolean};

const pad = (value: number) => String(value).padStart(2, '0');
export const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export function defaultRow(offsetDays = 1): Row {
  const date = new Date(); date.setDate(date.getDate() + offsetDays);
  return {date: localDate(date), from: '19:00', to: '21:00'};
}
/** About two hours from now, on the half hour, for two hours: today's suggestion when the customer is free right now. */
export function soonRow(): Row {
  const start = new Date(Date.now() + 2 * 60 * 60_000);
  start.setMinutes(start.getMinutes() <= 30 ? 30 : 60, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  if (localDate(end) !== localDate(new Date()) || localDate(start) !== localDate(new Date())) return defaultRow(1);
  return {date: localDate(start), from: `${pad(start.getHours())}:${pad(start.getMinutes())}`, to: `${pad(end.getHours())}:${pad(end.getMinutes())}`};
}
/** Browser-local date + times to ISO instants. */
const toSlot = (row: Row) => ({start: new Date(`${row.date}T${row.from}`).toISOString(), end: new Date(`${row.date}T${row.to}`).toISOString()});
export const browserTimeZone = () => typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Ho_Chi_Minh';

/** The times to send: "right now" becomes a window starting now, and the rows stay as fallbacks. Returns an error message instead when something is off. */
export function buildTiming(asap: boolean, rows: Row[]): {timing: Timing} | {error: string} {
  if (rows.some(row => !row.date || !row.from || !row.to)) return {error: 'Fill in the date and both times for every row.'};
  if (rows.some(row => row.to <= row.from)) return {error: 'Each end time must be after its start time (same day).'};
  const nowSlot = {start: new Date().toISOString(), end: new Date(Date.now() + 3 * 60 * 60_000).toISOString()};
  const slots = [...(asap ? [nowSlot] : []), ...rows.map(toSlot)].slice(0, MAX_SLOTS);
  const problem = slotProblem(slots) ?? asapProblem(asap, slots);
  return problem ? {error: problem} : {timing: {timeZone: browserTimeZone(), slots, asap}};
}

/** Date and from/to rows for the times a customer is free, in their own time zone. */
export function SlotRows({rows, asap, onChange}: {rows: Row[]; asap: boolean; onChange: (rows: Row[]) => void}) {
  return <>
    <div className="slot-rows">{rows.map((row, index) => <fieldset className="slot-row" key={index}>
      <legend>Time {index + 1}</legend>
      <label>Date<input type="date" required value={row.date} min={localDate(new Date())} onChange={event => onChange(rows.map((item, i) => i === index ? {...item, date: event.target.value} : item))}/></label>
      <label>From<input type="time" required value={row.from} onChange={event => onChange(rows.map((item, i) => i === index ? {...item, from: event.target.value} : item))}/></label>
      <label>To<input type="time" required value={row.to} onChange={event => onChange(rows.map((item, i) => i === index ? {...item, to: event.target.value} : item))}/></label>
      {rows.length > 1 && <button type="button" className="admin-remove-link" onClick={() => onChange(rows.filter((_, i) => i !== index))}>Remove</button>}
    </fieldset>)}</div>
    {rows.length < MAX_SLOTS - (asap ? 1 : 0) && <button type="button" className="secondary" onClick={() => onChange([...rows, defaultRow(rows.length + 1)])}>+ Add another time</button>}
  </>;
}
