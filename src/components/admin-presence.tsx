'use client';

import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {usePathname} from 'next/navigation';

export type PresenceAdmin = {id: string; name: string; email: string; resource: string; seenAt: string};
type PresenceValue = {admins: PresenceAdmin[]; self: string; setResource: (resource: string) => void};

const PresenceContext = createContext<PresenceValue>({admins: [], self: '', setResource: () => {}});
const POLL_MS = 3000;

/** Maps an admin URL to its default presence resource; the chat panel refines it to a specific room. */
function resourceFromPath(pathname: string) {
  const match = pathname.match(/\/admin\/(chat|settings(?:\/[a-z-]+)?|payments)/);
  return match?.[1] ?? 'chat';
}

export function AdminPresenceProvider({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const [admins, setAdmins] = useState<PresenceAdmin[]>([]);
  const [self, setSelf] = useState('');
  const [room, setRoom] = useState<string | null>(null);
  const pathResource = resourceFromPath(pathname);
  const resource = pathResource === 'chat' && room ? room : pathResource;
  const resourceRef = useRef(resource);
  resourceRef.current = resource;

  const beat = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/admin/presence', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({resource: resourceRef.current}), cache: 'no-store', signal});
      if (!response.ok) return;
      const data = await response.json() as {self: string; admins: PresenceAdmin[]};
      setSelf(data.self);
      setAdmins(data.admins);
    } catch { /* offline or aborted; the next tick retries */ }
  }, []);

  // Heartbeat immediately when the resource changes, then poll; pause while the tab is hidden.
  useEffect(() => {
    const controller = new AbortController();
    void beat(controller.signal);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void beat(controller.signal); }, POLL_MS);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [beat, resource]);

  useEffect(() => {
    const leave = () => navigator.sendBeacon?.('/api/admin/presence', new Blob([JSON.stringify({leave: true})], {type: 'application/json'}));
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, []);

  const setResource = useCallback((value: string) => setRoom(value.startsWith('chat:') ? value : null), []);
  return <PresenceContext.Provider value={{admins, self, setResource}}>{children}</PresenceContext.Provider>;
}

export function useAdminPresence() { return useContext(PresenceContext); }

/** Other admins currently on a resource (exact match, or prefix match for e.g. 'settings'). */
export function useViewers(resource: string, {prefix = false} = {}) {
  const {admins, self} = useAdminPresence();
  return admins.filter(admin => admin.id !== self && (admin.resource === resource || (prefix && admin.resource.startsWith(`${resource}/`))));
}

function label(admin: PresenceAdmin) {
  if (admin.resource.startsWith('chat:')) return 'in a customer chat';
  if (admin.resource === 'chat') return 'on the inbox';
  if (admin.resource.startsWith('settings')) return admin.resource === 'settings/products' ? 'on Products' : 'on Settings';
  return admin.resource === 'payments' ? 'on Payments' : admin.resource;
}

/** Compact chips; names are also written out for screen readers. */
export function PresenceBadges({viewers, context}: {viewers: PresenceAdmin[]; context?: string}) {
  if (!viewers.length) return null;
  const names = viewers.map(v => v.name).join(', ');
  return <span className="presence-badges" role="status" aria-label={`${names} ${viewers.length > 1 ? 'are' : 'is'} viewing ${context ?? 'this'}`} title={viewers.map(v => v.email).join(', ')}>
    {viewers.map(viewer => <span className="presence-chip" key={viewer.id} aria-hidden="true"><span className="presence-dot"/>{viewer.name}</span>)}
  </span>;
}

/** Header strip listing every other online admin and where they are. */
export function PresenceSummary() {
  const {admins, self} = useAdminPresence();
  const others = admins.filter(admin => admin.id !== self);
  if (!others.length) return <span className="presence-summary muted">{'Only you online'}</span>;
  return <ul className="presence-summary" aria-label="Admins online">
    {others.map(admin => <li key={admin.id} title={admin.email}><span className="presence-dot" aria-hidden="true"/>{admin.name} <small>{label(admin)}</small></li>)}
  </ul>;
}
