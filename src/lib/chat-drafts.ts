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
  try {for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key);} catch { /* Storage may be disabled. */ }
}
