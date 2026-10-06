'use client';

/** One compact trust total; individual order amounts and delivery times stay private. */
export function TradeFeed({stats}: {stats: {completed: number}}) {
  if (!stats.completed) return null;
  return <div className="trade-feed" aria-label="Completed trades">
    <strong>✓ {stats.completed.toLocaleString('en-US')} trade{stats.completed === 1 ? '' : 's'} completed</strong>
  </div>;
}
