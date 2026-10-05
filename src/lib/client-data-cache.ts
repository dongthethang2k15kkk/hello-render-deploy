'use client';

export type JsonResult<T> = {ok: boolean; status: number; data: T};
type Entry = {at: number; pending: boolean; promise: Promise<JsonResult<unknown>>};
type CacheRoot = typeof globalThis & {__jhJsonCache?: Map<string, Entry>};

const entries = (globalThis as CacheRoot).__jhJsonCache ??= new Map<string, Entry>();

/** Shares short-lived GET requests across components. Polling can force freshness without duplicating an in-flight request. */
export function loadJson<T>(url: string, options: {maxAgeMs?: number; force?: boolean; timeoutMs?: number} = {}) {
  const {maxAgeMs = 30_000, force = false, timeoutMs = 15_000} = options;
  const existing = entries.get(url);
  if (existing && (existing.pending || (!force && Date.now() - existing.at < maxAgeMs))) return existing.promise as Promise<JsonResult<T>>;

  const entry: Entry = {at: Date.now(), pending: true, promise: Promise.resolve({ok: false, status: 0, data: null})};
  entry.promise = fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(timeoutMs)}).then(async response => {
    const data = await response.json().catch(() => null);
    entry.pending = false;
    if (!response.ok && entries.get(url) === entry) entries.delete(url);
    return {ok: response.ok, status: response.status, data};
  }).catch(error => {
    if (entries.get(url) === entry) entries.delete(url);
    throw error;
  });
  entries.set(url, entry);
  return entry.promise as Promise<JsonResult<T>>;
}

export function invalidateJson(...prefixes: string[]) {
  for (const key of entries.keys()) if (prefixes.some(prefix => key === prefix || key.startsWith(prefix))) entries.delete(key);
}
