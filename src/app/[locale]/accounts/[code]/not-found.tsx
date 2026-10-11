import Link from 'next/link';

export default function AccountNotFound() {
  return <div className="empty-state"><div className="empty-icon">◇</div><h1>This account is no longer available</h1><p className="muted">It may have been sold or taken off sale. Other accounts are waiting in the store.</p><Link className="button" href="/en?shelf=accounts#catalog">See SkyBlock accounts →</Link></div>;
}
