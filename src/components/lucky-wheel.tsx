'use client';
import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';
import {formatCompactCoins, formatCoins} from '@/lib/coin-format';
import {invalidateJson, loadJson} from '@/lib/client-data-cache';

type Prize = {id: string; label: string; coinAmount: number; weight: number; sortOrder: number};
type State = {available: {id: string; orderId: string}[]; history: {id: string; prizeLabel: string | null; coinAmount: number | null; spunAt: string | null}[]; prizes: Prize[]; coinBalance: string};

const colors = ['#17251d', '#d9f85a', '#5b4bb7', '#ffcf5a', '#247a55', '#de6a7a'];

export default function LuckyWheel() {
  const [state, setState] = useState<State | null>(null);
  const [guest, setGuest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    loadJson<State & {error?: string}>('/api/lucky-wheel', {maxAgeMs: 30_000}).then(response => {
      if (response.status === 401) { setGuest(true); return; }
      if (!response.ok) throw new Error(response.data.error);
      setState(response.data);
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Lucky wheel could not be loaded.'));
  }, []);
  const prizes = useMemo(() => state?.prizes ?? [], [state]);
  const segment = 360 / Math.max(prizes.length, 1);
  const wheelBackground = prizes.length ? `conic-gradient(from ${-segment / 2}deg, ${prizes.map((_, index) => `${colors[index % colors.length]} ${index * segment}deg ${(index + 1) * segment}deg`).join(', ')})` : undefined;

  async function spin() {
    const spin = state?.available[0];
    if (!spin || busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/lucky-wheel', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({spinId: spin.id})});
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Spin failed.');
      const prizeIndex = Math.max(0, prizes.findIndex(item => item.id === body.prize.id));
      const target = (360 - prizeIndex * segment) % 360;
      setRotation(current => {
        const currentAngle = ((current % 360) + 360) % 360;
        return current + 1440 + ((target - currentAngle + 360) % 360);
      });
      window.setTimeout(() => {
        setResult(body.prize.label);
        setState(current => current && {...current, coinBalance: body.coinBalance, available: current.available.slice(1), history: [{id: spin.id, prizeLabel: body.prize.label, coinAmount: body.prize.coinAmount, spunAt: new Date().toISOString()}, ...current.history]});
        invalidateJson('/api/lucky-wheel', '/api/auth/session', '/api/account');
        window.dispatchEvent(new Event('jh-account-changed'));
        setBusy(false);
      }, 4200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Spin failed.');
      setBusy(false);
    }
  }

  return <section className="lucky-wheel-section" id="lucky-wheel">
    <div className="lucky-wheel-heading"><div><p className="eyebrow">LUCKY DROP</p><h2>Every paid order unlocks a spin.</h2><p className="muted">Only wheel prizes are added to this balance. On your next order, you can ask the Admin to deliver the whole balance with your package.</p></div><div className="lucky-wheel-stats">{state && <span className="lucky-wheel-balance">Balance <strong>{formatCompactCoins(state.coinBalance)}</strong></span>}<span className="lucky-wheel-count">{state?.available.length ?? 0} spin{state?.available.length === 1 ? '' : 's'} ready</span></div></div>
    {guest ? <div className="lucky-wheel-login card"><h3>Your next order could win big.</h3><p className="muted">Sign in to see your spins. A new account is created automatically when you complete checkout.</p><Link className="button" href="/en/login?next=%2Fen%23lucky-wheel">Sign in to spin →</Link></div> : <div className="lucky-wheel-card card">
      <div className="wheel-stage"><div className="wheel-pointer"/><div className="wheel-disc" style={{transform: `rotate(${rotation}deg)`, background: wheelBackground}}>{prizes.map((prize, index) => <div key={prize.id} className="wheel-slice" style={{transform: `rotate(${index * segment}deg)`}}><span>{formatCompactCoins(prize.coinAmount)}</span></div>)}</div><div className="wheel-core">✦</div></div>
      <div className="lucky-wheel-copy">{result ? <><p className="eyebrow">YOU WON</p><strong className="lucky-result">{result}</strong><p className="muted">Added to your balance. You now have <strong>{formatCoins(state?.coinBalance)}</strong>.</p></> : <><p className="eyebrow">YOUR TURN</p><h3>{state?.available.length ? 'Ready when you are.' : 'No spins yet.'}</h3><p className="muted">Complete a successful payment to receive one spin for that order.</p></>}{state?.available.length ? <button className="button lucky-spin-button" type="button" disabled={busy} onClick={() => void spin()}>{busy ? 'Spinning…' : 'Spin the wheel →'}</button> : <Link className="text-link" href="#catalog">Explore packages ↗</Link>}{error && <p className="admin-feedback error" role="alert">{error}</p>}</div>
    </div>}
    {state?.history.length ? <details className="lucky-history"><summary>View your spin history ({state.history.length})</summary><ul>{state.history.map(item => <li key={item.id}><strong>{item.prizeLabel ?? 'Prize'}</strong><span>{item.spunAt ? new Date(item.spunAt).toLocaleString() : ''}</span></li>)}</ul></details> : null}
  </section>;
}
