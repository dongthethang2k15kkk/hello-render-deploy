'use client';
import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';

type Prize = {id: string; label: string; coinAmount: number; weight: number; sortOrder: number};
type State = {available: {id: string; orderId: string}[]; history: {id: string; prizeLabel: string | null; coinAmount: number | null; spunAt: string | null}[]; prizes: Prize[]};

const money = (value: number) => `${(value / 1_000_000).toLocaleString('en-US', {maximumFractionDigits: 0})}M`;

export default function LuckyWheel() {
  const [state, setState] = useState<State | null>(null);
  const [guest, setGuest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/lucky-wheel', {cache: 'no-store'}).then(async response => { if (response.status === 401) { setGuest(true); return; } const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body); }).catch(cause => setError(cause instanceof Error ? cause.message : 'Lucky wheel could not be loaded.')); }, []);
  const prizes = useMemo(() => state?.prizes ?? [], [state]);
  async function spin() {
    const spin = state?.available[0]; if (!spin || busy) return;
    setBusy(true); setError(''); setResult(null);
    const response = await fetch('/api/lucky-wheel', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({spinId: spin.id})});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error ?? 'Spin failed.'); setBusy(false); return; }
    const index = prizes.findIndex(item => item.id === body.prize.id);
    const segment = 360 / Math.max(prizes.length, 1);
    setRotation(current => current + 1440 + (360 - index * segment - segment / 2));
    window.setTimeout(() => { setResult(body.prize.label); setState(current => current && {...current, available: current.available.slice(1), history: [{id: spin.id, prizeLabel: body.prize.label, coinAmount: body.prize.coinAmount, spunAt: new Date().toISOString()}, ...current.history]}); setBusy(false); }, 4200);
  }
  return <section className="lucky-wheel-section" id="lucky-wheel"><div className="lucky-wheel-heading"><div><p className="eyebrow">LUCKY DROP</p><h2>Every paid order unlocks a spin.</h2><p className="muted">Spin once per order and see what the wheel brings you.</p></div><span className="lucky-wheel-count">{state?.available.length ?? 0} spin{state?.available.length === 1 ? '' : 's'} ready</span></div>
    {guest ? <div className="lucky-wheel-login card"><h3>Your next order could win big.</h3><p className="muted">Sign in to see your spins. A new account is created automatically when you complete checkout.</p><Link className="button" href="/en/login?next=%2Fen%23lucky-wheel">Sign in to spin →</Link></div> : <div className="lucky-wheel-card card"><div className="wheel-stage"><div className="wheel-pointer"/><div className="wheel-disc" style={{transform: `rotate(${rotation}deg)`}}>{prizes.map((prize, index) => <div key={prize.id} className="wheel-slice" style={{transform: `rotate(${index * (360 / Math.max(prizes.length, 1))}deg)`, background: index % 2 ? '#d9f85a' : '#17251d'}}><span style={{transform: `rotate(${(360 / Math.max(prizes.length, 1)) / 2}deg)`}}>{money(prize.coinAmount)}</span></div>)}</div><div className="wheel-core">✦</div></div><div className="lucky-wheel-copy">{result ? <><p className="eyebrow">YOU WON</p><strong className="lucky-result">{result}</strong><p className="muted">Your result has been saved to your spin history.</p></> : <><p className="eyebrow">YOUR TURN</p><h3>{state?.available.length ? 'Ready when you are.' : 'No spins yet.'}</h3><p className="muted">Complete a successful payment to receive one spin for that order.</p></>}{state?.available.length ? <button className="button lucky-spin-button" type="button" disabled={busy} onClick={() => void spin()}>{busy ? 'Spinning…' : 'Spin the wheel →'}</button> : <Link className="text-link" href="#catalog">Explore packages ↗</Link>}{error && <p className="admin-feedback error" role="alert">{error}</p>}</div></div>}
    {state?.history.length ? <details className="lucky-history"><summary>View your spin history ({state.history.length})</summary><ul>{state.history.map(item => <li key={item.id}><strong>{item.prizeLabel ?? 'Prize'}</strong><span>{item.spunAt ? new Date(item.spunAt).toLocaleString() : ''}</span></li>)}</ul></details> : null}</section>;
}
