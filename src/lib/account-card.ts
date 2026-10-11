// The short version of a game account that the storefront catalog carries (no Node.js imports; unit-tested).
// The whole snapshot is only loaded on the account's own page: the catalog is fetched on every page of the store.
import {z} from 'zod';
import {effectivePrice} from './account-rules';
import {accountStatsSchema, skillFill, type AccountStats} from './skyblock-stats';

export const accountCardSchema = z.object({
  code: z.string().min(1).max(20),
  profileName: z.string().nullable(),
  gameMode: z.string(),
  // Only present when the Admin switched "Show IGN" on for this account.
  ign: z.string().nullable(),
  level: z.number().int().min(0),
  farmingLevel: z.number().int().min(0).nullable(),
  /** Farming bar fill, 0–1. */
  farmingFill: z.number().min(0).max(1),
  farmingMaxed: z.boolean(),
  averageSkill: z.number().nullable(),
  networth: z.number().nullable(),
  purse: z.number().nullable(),
  setName: z.string().nullable(),
  /** Rarity of the armor pieces (the set's colour on the card). */
  setRarity: z.string().nullable(),
  imagePath: z.string(),
  status: z.enum(['available', 'reserved'])
}).strict();
export type AccountCard = z.infer<typeof accountCardSchema>;

type CardSource = {code: string; ign: string; showIgn: boolean; profileName: string | null; imagePaths: unknown; status: string; stats: unknown};

export function toAccountCard(account: CardSource): AccountCard {
  const parsed = accountStatsSchema.safeParse(account.stats);
  const stats: AccountStats | null = parsed.success ? parsed.data : null;
  const farming = stats?.skills.find(skill => skill.key === 'FARMING');
  const images = Array.isArray(account.imagePaths) ? account.imagePaths.filter((path): path is string => typeof path === 'string') : [];
  return {
    code: account.code, profileName: account.profileName ?? stats?.profile.cuteName ?? null, gameMode: stats?.profile.gameMode ?? 'normal', ign: account.showIgn ? account.ign : null,
    level: stats?.level.level ?? 0, farmingLevel: farming?.level ?? null, farmingFill: farming ? skillFill(farming) : 0, farmingMaxed: farming?.maxed ?? false,
    averageSkill: stats && stats.skills.length ? stats.summary.averageSkill : null, networth: stats?.summary.networth ?? null, purse: stats?.summary.purse ?? null,
    setName: stats?.gear.armor?.setName ?? null, setRarity: stats?.gear.armor?.items[0]?.rarity ?? null, imagePath: images[0] ?? '', status: account.status === 'reserved' ? 'reserved' : 'available'
  };
}

/** The catalog line for an account for sale: one unit, no delivery form, a price like any package. */
export function accountCatalogLine(account: CardSource & {id: string; title: string; description: string; priceVnd: number; salePriceVnd: number | null}) {
  const price = effectivePrice(account);
  const card = toAccountCard(account);
  return {
    id: account.id, sourceProductId: account.id, slug: account.code.toLowerCase(), sku: account.code, category: 'skyblock-account', imagePath: card.imagePath,
    priceVnd: price, basePriceVnd: account.priceVnd, salePriceVnd: price < account.priceVnd ? price : null, stock: account.status === 'available' ? 1 : 0,
    title: {en: account.title}, description: {en: account.description}, fields: [], kind: 'account' as const, account: card
  };
}
