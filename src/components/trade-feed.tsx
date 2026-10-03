'use client';
import {useEffect, useState} from 'react';

const ago = (iso: string, now: number) => {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
};

/** Real completed trades only (never a made-up counter); hidden until the first trade is completed. */
export function TradeFeed({stats}: {stats: {completed: number; recent: {label: string; at: string}[]}}) {
  // Relative times are worked out in the browser, so the cached server page never shows a stale "2 min ago".
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  if (!stats.completed) return null;
  return <div className="trade-feed" aria-label="Recent trades">
    <strong>✓ {stats.completed.toLocaleString('en-US')} trade{stats.completed === 1 ? '' : 's'} completed</strong>
    <ul>{stats.recent.map(item => <li key={item.at}><span>{item.label} delivered</span>{now && <small>{ago(item.at, now)}</small>}</li>)}</ul>
  </div>;
}
