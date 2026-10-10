// What a customer sees of a SkyBlock account: one snapshot built from a Hypixel profile (no Node.js or Prisma imports; unit-tested).
// Written from the public Hypixel API shapes only. Nothing here is copied from SkyCrypt (AGPL).
import {z} from 'zod';

export const SKILL_KEYS = ['ALCHEMY', 'CARPENTRY', 'COMBAT', 'ENCHANTING', 'FARMING', 'FISHING', 'FORAGING', 'HUNTING', 'MINING', 'RUNECRAFTING', 'SOCIAL', 'TAMING'] as const;
export type SkillKey = typeof SKILL_KEYS[number];
export const skillLabel = (key: string) => key.charAt(0) + key.slice(1).toLowerCase();
/** The average skill level leaves out the two cosmetic skills. */
const AVERAGE_EXCLUDED = new Set<string>(['RUNECRAFTING', 'SOCIAL']);

const gearItem = z.object({name: z.string().max(120), rarity: z.string().max(30), slot: z.string().max(30)});
const gearGroup = z.object({
  setName: z.string().max(120).nullable(),
  bonus: z.array(z.object({stat: z.string().max(60), short: z.string().max(30), value: z.number()})).max(30),
  items: z.array(gearItem).max(8)
});
export const accountStatsSchema = z.object({
  version: z.literal(1),
  fetchedAt: z.string(),
  source: z.enum(['hypixel', 'manual']),
  profile: z.object({cuteName: z.string().max(60).nullable(), gameMode: z.string().max(30), coop: z.boolean()}),
  level: z.object({level: z.number().int().min(0).max(100000), xp: z.number().min(0), next: z.number().min(1)}),
  skills: z.array(z.object({key: z.string().max(30), label: z.string().max(40), level: z.number().int().min(0).max(100), cap: z.number().int().min(1).max(100), xpInto: z.number().min(0), xpNext: z.number().min(0).nullable(), totalXp: z.number().min(0), maxed: z.boolean()})).max(20),
  summary: z.object({
    joinedAt: z.string().nullable(), purse: z.number().min(0).nullable(), bank: z.number().min(0).nullable(), averageSkill: z.number().min(0).max(100),
    fairySouls: z.object({collected: z.number().int().min(0), total: z.number().int().min(0)}).nullable(), networth: z.number().min(0).nullable(), nonCosmeticNetworth: z.number().min(0).nullable()
  }),
  gear: z.object({inventoryApiOff: z.boolean(), armor: gearGroup.nullable(), equipment: gearGroup.nullable()})
});
export type AccountStats = z.infer<typeof accountStatsSchema>;
export type GearGroup = z.infer<typeof gearGroup>;
export type SkillStat = AccountStats['skills'][number];

// ---------- Numbers ----------

/** 162.90M, 849.23M, 1.28M, 61.72K. Below 10K the whole number is written with thousands separators. */
export function formatCompact(value: number) {
  const abs = Math.abs(value);
  const unit = (divisor: number, suffix: string) => `${(value / divisor).toFixed(2)}${suffix}`;
  if (abs >= 1e12) return unit(1e12, 'T');
  if (abs >= 1e9) return unit(1e9, 'B');
  if (abs >= 1e6) return unit(1e6, 'M');
  if (abs >= 1e4) return unit(1e3, 'K');
  return Math.round(value).toLocaleString('en-US');
}

// ---------- Skills ----------

/** Cumulative XP needed to reach level 1, 2, 3, … of every skill, from Hypixel's public `resources/skyblock/skills`. */
export type SkillTable = Record<string, {maxLevel: number; cumulative: number[]}>;

export function skillTableFromResource(resource: unknown): SkillTable {
  const skills = (resource as {skills?: Record<string, {maxLevel?: number; levels?: {level: number; totalExpRequired: number}[]}>})?.skills ?? {};
  const table: SkillTable = {};
  for (const [key, skill] of Object.entries(skills)) {
    const levels = [...(skill.levels ?? [])].sort((a, b) => a.level - b.level);
    if (!levels.length) continue;
    table[key.toUpperCase()] = {maxLevel: skill.maxLevel ?? levels.length, cumulative: levels.map(item => item.totalExpRequired)};
  }
  return table;
}

/** Level, progress inside the level and XP the next level needs, for a total XP amount. `cap` stops the level (Farming's cap depends on the player). */
export function skillFromXp(key: string, totalXp: number, table: SkillTable, cap?: number): SkillStat {
  const entry = table[key];
  const xp = Math.max(0, Number.isFinite(totalXp) ? totalXp : 0);
  const max = Math.min(cap ?? entry?.maxLevel ?? 0, entry?.maxLevel ?? 0) || 1;
  const cumulative = entry?.cumulative ?? [];
  let level = 0;
  while (level < max && level < cumulative.length && xp >= cumulative[level]) level++;
  const maxed = level >= max;
  const floor = level > 0 ? cumulative[level - 1] : 0;
  return {key, label: skillLabel(key), level, cap: max, xpInto: maxed ? 0 : xp - floor, xpNext: maxed ? null : (cumulative[level] ?? floor) - floor, totalXp: xp, maxed};
}

/** Average of the whole levels of every skill except Runecrafting and Social. */
export function averageSkill(skills: {key: string; level: number}[]) {
  const counted = skills.filter(skill => !AVERAGE_EXCLUDED.has(skill.key));
  if (!counted.length) return 0;
  return Math.round((counted.reduce((sum, skill) => sum + skill.level, 0) / counted.length) * 100) / 100;
}

/** Hypixel's SkyBlock level: 100 XP per level. */
export function skyblockLevel(xp: number) {
  const whole = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  return {level: Math.floor(whole / 100), xp: whole % 100, next: 100};
}

// ---------- Gear ----------

export type RawItem = {name: string; lore: string[]; id?: string; modifier?: string};

/** Removes Minecraft colour codes ("§a") and the star and rune decorations that follow item names. */
export const stripFormatting = (text: string) => text.replace(/§./g, '').replace(/[✪➊➋➌➍➎✦⚚]/g, '').replace(/\s+/g, ' ').trim();

const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SPECIAL'];
/** "EPIC BOOTS" is the last lore line: the first word is the rarity. "VERY SPECIAL" counts as special. */
export function itemRarity(lore: string[]) {
  const last = stripFormatting(lore.at(-1) ?? '').toUpperCase().replace(/^VERY SPECIAL/, 'SPECIAL');
  const word = last.split(' ')[0];
  return RARITIES.includes(word) ? word : 'COMMON';
}

const SLOT_WORDS = /\s+(Helmet|Chestplate|Leggings|Boots)$/i;
export const ARMOR_SLOTS = ['Boots', 'Leggings', 'Chestplate', 'Helmet'] as const;
/** In the API the equipment list runs necklace, cloak, belt, gloves. */
export const EQUIPMENT_SLOTS = ['Necklace', 'Cloak', 'Belt', 'Gloves'] as const;

/** "Mantid Fermento Armor" when all four pieces are the same set, otherwise null. Reforge prefixes are ignored. */
export function armorSetName(items: RawItem[]) {
  if (items.length !== 4) return null;
  const bases = items.map(item => {
    const name = stripFormatting(item.name);
    const reforge = item.modifier ? item.modifier.charAt(0).toUpperCase() + item.modifier.slice(1) : '';
    return (reforge && name.startsWith(`${reforge} `) ? name.slice(reforge.length + 1) : name).replace(SLOT_WORDS, '');
  });
  const ids = items.map(item => (item.id ?? '').replace(/_(HELMET|CHESTPLATE|LEGGINGS|BOOTS)$/, ''));
  const sameId = ids.every(id => id && id === ids[0]);
  return sameId || bases.every(base => base === bases[0]) ? `${bases[0]} Armor` : null;
}

/** Abbreviation and colour of the stats shown in the "Bonus" line. Unknown stats keep their own name. */
export const STAT_STYLE: Record<string, {short: string; color: string}> = {
  'Farming Fortune': {short: 'FrmFrt', color: '#ffaa00'}, 'Bonus Pest Chance': {short: 'BPC', color: '#55ff55'}, Defense: {short: 'Def', color: '#55ff55'},
  Health: {short: 'HP', color: '#ff5555'}, Speed: {short: 'Spd', color: '#ffffff'}, Strength: {short: 'Str', color: '#ff5555'}, 'Crit Chance': {short: 'CC', color: '#5555ff'},
  'Crit Damage': {short: 'CD', color: '#5555ff'}, Intelligence: {short: 'Int', color: '#55ffff'}, 'Mining Fortune': {short: 'MnFrt', color: '#ffaa00'}, 'Foraging Fortune': {short: 'FrgFrt', color: '#ffaa00'}
};
export const statColor = (short: string) => Object.values(STAT_STYLE).find(style => style.short === short)?.color ?? '#aaaaaa';

/** "Farming Fortune: +120" in an item's stat block (the lines before the first blank line). Other lines such as "Gear Score: 400" have no plus sign and are ignored. */
export function itemStats(lore: string[]) {
  const stats: {stat: string; value: number}[] = [];
  for (const line of lore) {
    const text = stripFormatting(line);
    if (!text) break;
    const match = /^([A-Za-z][A-Za-z' ]{1,30}): \+([\d,]+(?:\.\d+)?)/.exec(text);
    if (match) stats.push({stat: match[1].trim(), value: Number(match[2].replace(/,/g, ''))});
  }
  return stats;
}

export function buildGearGroup(items: RawItem[], slots: readonly string[], withSet: boolean): GearGroup | null {
  const kept = items.map((item, index) => ({item, slot: slots[index] ?? ''})).filter(entry => entry.item.name);
  if (!kept.length) return null;
  const totals = new Map<string, number>();
  for (const {item} of kept) for (const {stat, value} of itemStats(item.lore)) totals.set(stat, (totals.get(stat) ?? 0) + value);
  const bonus = [...totals].map(([stat, value]) => ({stat, short: STAT_STYLE[stat]?.short ?? stat, value: Math.round(value * 100) / 100})).sort((a, b) => b.value - a.value);
  return {
    setName: withSet ? armorSetName(items.filter(item => item.name)) : null, bonus,
    items: kept.map(({item, slot}) => ({name: stripFormatting(item.name).slice(0, 120), rarity: itemRarity(item.lore), slot}))
  };
}

// ---------- The whole snapshot ----------

type Member = {
  leveling?: {experience?: number};
  player_data?: {experience?: Record<string, number>};
  currencies?: {coin_purse?: number};
  profile?: {first_join?: number; bank_account?: number};
  fairy_soul?: {total_collected?: number};
  jacobs_contest?: {perks?: {farming_level_cap?: number}};
};

export type StatsInput = {
  member: Member;
  /** Profile-wide bank balance; null when the player's banking API is off. */
  bankBalance: number | null;
  table: SkillTable;
  profile: {cuteName: string | null; gameMode: string; coop: boolean};
  fairySoulsTotal: number;
  networth: {total: number; nonCosmetic: number} | null;
  /** Null when the player's Inventory API is off. */
  gear: {armor: RawItem[]; equipment: RawItem[]} | null;
  now?: Date;
};

export function buildAccountStats(input: StatsInput): AccountStats {
  const {member, table} = input;
  const xp = member.player_data?.experience ?? {};
  const farmingCap = 50 + (member.jacobs_contest?.perks?.farming_level_cap ?? 0);
  // Skills the API has no XP for yet (new skills such as Hunting) stay at level 0 rather than disappearing.
  const skills = SKILL_KEYS.filter(key => table[key]).map(key => skillFromXp(key, xp[`SKILL_${key}`] ?? 0, table, key === 'FARMING' ? farmingCap : undefined));
  const bank = input.bankBalance ?? (typeof member.profile?.bank_account === 'number' ? member.profile.bank_account : null);
  const collected = member.fairy_soul?.total_collected;
  return {
    version: 1, fetchedAt: (input.now ?? new Date()).toISOString(), source: 'hypixel', profile: input.profile,
    level: skyblockLevel(member.leveling?.experience ?? 0), skills,
    summary: {
      joinedAt: member.profile?.first_join ? new Date(member.profile.first_join).toISOString() : null,
      purse: typeof member.currencies?.coin_purse === 'number' ? member.currencies.coin_purse : null, bank,
      averageSkill: averageSkill(skills),
      fairySouls: typeof collected === 'number' ? {collected, total: Math.max(collected, input.fairySoulsTotal)} : null,
      networth: input.networth?.total ?? null, nonCosmeticNetworth: input.networth?.nonCosmetic ?? null
    },
    gear: input.gear ? {inventoryApiOff: false, armor: buildGearGroup(input.gear.armor, ARMOR_SLOTS, true), equipment: buildGearGroup(input.gear.equipment, EQUIPMENT_SLOTS, false)} : {inventoryApiOff: true, armor: null, equipment: null}
  };
}

/** An empty snapshot for an account entered by hand: the Admin fills in the numbers. */
export function manualAccountStats(table: SkillTable, now = new Date()): AccountStats {
  return {
    version: 1, fetchedAt: now.toISOString(), source: 'manual', profile: {cuteName: null, gameMode: 'normal', coop: false}, level: {level: 0, xp: 0, next: 100},
    skills: SKILL_KEYS.map(key => ({key, label: skillLabel(key), level: 0, cap: table[key]?.maxLevel ?? 50, xpInto: 0, xpNext: null, totalXp: 0, maxed: false})),
    summary: {joinedAt: null, purse: null, bank: null, averageSkill: 0, fairySouls: null, networth: null, nonCosmeticNetworth: null},
    gear: {inventoryApiOff: false, armor: null, equipment: null}
  };
}

/** 849M, 1.3B: a networth in as few characters as a title allows. */
const shortNetworth = (value: number) => value >= 1e9 ? `${(Math.round(value / 1e8) / 10).toString()}B` : value >= 1e6 ? `${Math.round(value / 1e6)}M` : value >= 1e3 ? `${Math.round(value / 1e3)}K` : String(Math.round(value));

/** The title suggested to an Admin: "Farming 45 · Mantid Fermento Armor · 849M NW". */
export function suggestTitle(stats: AccountStats) {
  const farming = stats.skills.find(skill => skill.key === 'FARMING');
  const parts = [farming ? `Farming ${farming.level}` : '', stats.gear.armor?.setName ?? '', stats.summary.networth ? `${shortNetworth(stats.summary.networth)} NW` : ''];
  return parts.filter(Boolean).join(' · ');
}

/** Fraction of a skill bar to fill (0–1). A skill entered by hand without progress fills in proportion to its level. */
export const skillFill = (skill: SkillStat) => skill.maxed ? 1 : skill.xpNext ? Math.min(1, skill.xpInto / skill.xpNext) : Math.min(1, skill.level / Math.max(1, skill.cap));

export const GAME_MODES: Record<string, string> = {normal: 'Classic', ironman: 'Ironman', stranded: 'Stranded', bingo: 'Bingo'};
