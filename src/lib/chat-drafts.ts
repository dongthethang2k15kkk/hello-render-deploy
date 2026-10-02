const prefix = 'shop-chat-drafts:';
export function readDrafts(accountId: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(prefix + accountId) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => key.startsWith('user:') && typeof value === 'string' && value.length <= 1000));
  } catch {return {};}
}
export function saveDrafts(accountId: string, drafts: Record<string, string>) {
  try {sessionStorage.setItem(prefix + accountId, JSON.stringify(Object.fromEntries(Object.entries(drafts).filter(([, body]) => body))));} catch { /* Editing still works when storage is unavailable. */ }
}
export function clearChatDrafts() {
  try {for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix) || key.startsWith(cachePrefix)) sessionStorage.removeItem(key);} catch { /* Storage may be disabled. */ }
}

// Last seen conversations for this tab, shown instantly while the server copy refreshes. The database stays the
// source of truth: every message is still saved by the server the moment it is sent.
const cachePrefix = 'shop-chat-cache:';
type Cached<R, M> = {rooms: R[]; messages: M[]};
export function readChatCache<R, M>(accountId: string): Cached<R, M> | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(cachePrefix + accountId) ?? 'null') as Cached<R, M> | null;
    return parsed && Array.isArray(parsed.rooms) && Array.isArray(parsed.messages) ? parsed : null;
  } catch {return null;}
}
export function saveChatCache<R, M>(accountId: string, cache: Cached<R, M>) {
  try {sessionStorage.setItem(cachePrefix + accountId, JSON.stringify(cache));} catch { /* Full or blocked storage only loses the shortcut. */ }
}
