// In-memory admin presence: who is viewing which chat room or settings page.
// Single-instance only (Render free runs one instance); entries expire after the TTL.
export const PRESENCE_TTL_MS = 20_000;

export type PresenceEntry = {adminId: string; name: string; email: string; resource: string; seenAt: number};

const resourcePattern = /^(chat:user:[A-Za-z0-9_-]{1,64}|chat|settings(\/[a-z-]{1,40})?|payments)$/;
export function isValidResource(value: unknown): value is string {
  return typeof value === 'string' && resourcePattern.test(value);
}

export function createPresenceStore(now: () => number = Date.now) {
  const entries = new Map<string, PresenceEntry>();
  const prune = () => {
    const cutoff = now() - PRESENCE_TTL_MS;
    for (const [key, entry] of entries) if (entry.seenAt < cutoff) entries.delete(key);
  };
  return {
    /** One entry per admin: a heartbeat moves the admin to the new resource. */
    beat(adminId: string, name: string, email: string, resource: string) {
      entries.set(adminId, {adminId, name, email, resource, seenAt: now()});
      prune();
    },
    leave(adminId: string) { entries.delete(adminId); },
    list() { prune(); return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name)); }
  };
}

const globalPresence = globalThis as unknown as {adminPresence?: ReturnType<typeof createPresenceStore>};
export function presenceStore() {
  globalPresence.adminPresence ??= createPresenceStore();
  return globalPresence.adminPresence;
}
