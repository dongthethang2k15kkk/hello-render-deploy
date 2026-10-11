// Search and sort of the accounts shelf, and small display helpers (no Node.js imports; unit-tested).
import type {CatalogProduct} from './catalog';

export type AccountSort = 'featured' | 'price-low' | 'price-high' | 'networth' | 'farming';
export const ACCOUNT_SORTS: [AccountSort, string][] = [['featured', 'Featured'], ['price-low', 'Price: low to high'], ['price-high', 'Price: high to low'], ['networth', 'Networth: high to low'], ['farming', 'Farming level: high to low']];

/** Accounts matching the search (title, code, profile, set, and the IGN when it is public), in the chosen order. Ties keep the shop's own order. */
export function filterAccounts(accounts: CatalogProduct[], query: string, sort: AccountSort) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = accounts.filter(product => {
    const haystack = [product.title.en, product.sku, product.account?.profileName, product.account?.setName, product.account?.ign].filter(Boolean).join(' ').toLowerCase();
    return words.every(word => haystack.includes(word));
  });
  const number = (value: number | null | undefined) => value ?? -1;
  const by: Record<AccountSort, ((a: CatalogProduct, b: CatalogProduct) => number) | null> = {
    featured: null, 'price-low': (a, b) => a.priceVnd - b.priceVnd, 'price-high': (a, b) => b.priceVnd - a.priceVnd,
    networth: (a, b) => number(b.account?.networth) - number(a.account?.networth), farming: (a, b) => number(b.account?.farmingLevel) - number(a.account?.farmingLevel)
  };
  const compare = by[sort];
  return compare ? [...matching].sort(compare) : matching;
}

/** "3 hours ago", "2 years ago". */
export function timeAgo(value: string | Date | null, now = Date.now()) {
  if (!value) return null;
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return null;
  const units: [number, string][] = [[365 * 86400, 'year'], [30 * 86400, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [size, name] of units) if (seconds >= size) { const count = Math.floor(seconds / size); return `${count} ${name}${count === 1 ? '' : 's'} ago`; }
  return 'just now';
}

/** Where the player's stats can be read in full. Only used when the Admin chose to show the IGN. */
export const skyCryptUrl = (ign: string, profile: string | null) => `https://sky.shiiyu.moe/stats/${encodeURIComponent(ign)}${profile ? `/${encodeURIComponent(profile)}` : ''}`;
export const eliteUrl = (ign: string, profile: string | null) => `https://elitebot.dev/@${encodeURIComponent(ign)}${profile ? `/${encodeURIComponent(profile)}` : ''}`;

export const RARITY_COLORS: Record<string, string> = {COMMON: '#ffffff', UNCOMMON: '#55ff55', RARE: '#5555ff', EPIC: '#aa00aa', LEGENDARY: '#ffaa00', MYTHIC: '#ff55ff', DIVINE: '#55ffff', SPECIAL: '#ff5555'};
export const rarityColor = (rarity: string | null | undefined) => RARITY_COLORS[rarity ?? ''] ?? RARITY_COLORS.COMMON;
