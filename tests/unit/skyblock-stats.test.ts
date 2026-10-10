import {describe, expect, it} from 'vitest';
import profileFixture from '../fixtures/skyblock-profile.json';
import skillsFixture from '../fixtures/skyblock-skills.json';
import {accountStatsSchema, armorSetName, averageSkill, buildAccountStats, formatCompact, itemRarity, itemStats, manualAccountStats, skillFill, skillFromXp, skillTableFromResource, skyblockLevel, stripFormatting, suggestTitle} from '../../src/lib/skyblock-stats';

// The fixture is synthetic: made-up numbers that match the sample account in the shop owner's screenshot (level 138, Farming 45, average 30.30).
const table = skillTableFromResource(skillsFixture);
const base = {table, profile: profileFixture.profile, fairySoulsTotal: 289, networth: profileFixture.networth, now: new Date('2026-10-11T00:00:00Z')};
const full = () => buildAccountStats({...base, member: profileFixture.member, bankBalance: profileFixture.bankBalance, gear: profileFixture.gear});

describe('SkyBlock level and skills', () => {
  it('derives the SkyBlock level from XP', () => {
    expect(skyblockLevel(13842)).toEqual({level: 138, xp: 42, next: 100});
    expect(skyblockLevel(0)).toEqual({level: 0, xp: 0, next: 100});
    expect(skyblockLevel(NaN)).toEqual({level: 0, xp: 0, next: 100});
  });

  it('reads skill levels from the Hypixel table, with progress inside the level', () => {
    const farming = skillFromXp('FARMING', 39_145_425, table);
    expect(farming).toMatchObject({level: 45, maxed: false, label: 'Farming'});
    expect(farming.xpInto).toBeGreaterThan(0);
    expect(farming.xpNext).toBeGreaterThan(farming.xpInto);
    // Exactly the XP of a level reaches it; one XP less does not.
    const need = table.FARMING.cumulative[9];
    expect(skillFromXp('FARMING', need, table).level).toBe(10);
    expect(skillFromXp('FARMING', need - 1, table).level).toBe(9);
    expect(skillFromXp('FARMING', 0, table)).toMatchObject({level: 0, xpInto: 0});
  });

  it('stops at the cap, which turns the bar gold (maxed) and drops the next-level XP', () => {
    const capped = skillFromXp('FARMING', 999_999_999, table, 50);
    expect(capped).toMatchObject({level: 50, cap: 50, maxed: true, xpNext: null, xpInto: 0});
    expect(skillFill(capped)).toBe(1);
    expect(skillFromXp('FISHING', 999_999_999, table).level).toBe(50);
    expect(skillFromXp('FARMING', 999_999_999, table).level).toBe(60);
  });

  it('raises the Farming cap with the player\'s Jacob perks only', () => {
    const member = {...profileFixture.member, player_data: {experience: {SKILL_FARMING: 999_999_999}}};
    const level = (perk: number) => buildAccountStats({...base, member: {...member, jacobs_contest: {perks: {farming_level_cap: perk}}}, bankBalance: null, gear: null}).skills.find(skill => skill.key === 'FARMING')!;
    expect(level(0)).toMatchObject({level: 50, maxed: true});
    expect(level(7)).toMatchObject({level: 57, cap: 57, maxed: true});
    expect(level(30).level).toBe(60);
  });

  it('averages the whole levels of ten skills, leaving out Runecrafting and Social', () => {
    const stats = full();
    expect(stats.skills).toHaveLength(12);
    expect(averageSkill(stats.skills)).toBe(30.3);
    expect(averageSkill([{key: 'SOCIAL', level: 25}, {key: 'RUNECRAFTING', level: 25}])).toBe(0);
    expect(averageSkill([])).toBe(0);
  });
});

describe('the account snapshot', () => {
  const stats = full();

  it('matches the sample account: level 138, Farming 45, average 30.30, twelve skills in alphabetical order', () => {
    expect(stats.level).toEqual({level: 138, xp: 42, next: 100});
    expect(stats.skills.map(skill => skill.label)).toEqual(['Alchemy', 'Carpentry', 'Combat', 'Enchanting', 'Farming', 'Fishing', 'Foraging', 'Hunting', 'Mining', 'Runecrafting', 'Social', 'Taming']);
    expect(Object.fromEntries(stats.skills.map(skill => [skill.key, skill.level]))).toMatchObject({FARMING: 45, ALCHEMY: 20, CARPENTRY: 29, COMBAT: 30, ENCHANTING: 44, FISHING: 16, FORAGING: 28, HUNTING: 17, MINING: 33, TAMING: 41});
    expect(stats.summary.averageSkill).toBe(30.3);
  });

  it('carries purse, bank, fairy souls, networth and the profile', () => {
    expect(stats.summary).toMatchObject({purse: 162_900_000, bank: 849_230_000, fairySouls: {collected: 241, total: 289}, networth: 849_230_000, nonCosmeticNetworth: 801_100_000});
    expect(stats.summary.joinedAt).toBe('2024-09-01T00:00:00.000Z');
    expect(stats.profile).toEqual({cuteName: 'Mango', gameMode: 'ironman', coop: false});
    expect(stats.source).toBe('hypixel');
  });

  it('passes its own schema, and a missing field becomes null instead of breaking the page', () => {
    expect(accountStatsSchema.safeParse(stats).success).toBe(true);
    const bare = buildAccountStats({...base, member: {}, bankBalance: null, networth: null, gear: null});
    expect(bare.summary).toMatchObject({purse: null, bank: null, fairySouls: null, networth: null, nonCosmeticNetworth: null, joinedAt: null});
    expect(bare.level.level).toBe(0);
    expect(accountStatsSchema.safeParse(bare).success).toBe(true);
  });

  it('never lets the fairy soul total drop below what was collected', () => {
    expect(buildAccountStats({...base, member: {fairy_soul: {total_collected: 300}}, bankBalance: null, gear: null}).summary.fairySouls).toEqual({collected: 300, total: 300});
  });

  it('suggests a title from Farming, the armor set and networth', () => {
    expect(suggestTitle(stats)).toBe('Farming 45 · Fermento Armor · 849M NW');
    expect(suggestTitle(manualAccountStats(table))).toBe('Farming 0');
  });
});

describe('gear', () => {
  const stats = full();

  it('names a full set once, ignoring the reforge prefix on each piece', () => {
    expect(stats.gear.armor?.setName).toBe('Fermento Armor');
    const mixed = profileFixture.gear.armor.map((piece, index) => ({...piece, modifier: ['fierce', 'pure', 'jaded', 'mantid'][index], name: `§5${['Fierce', 'Pure', 'Jaded', 'Mantid'][index]} Fermento ${['Boots', 'Leggings', 'Chestplate', 'Helmet'][index]}`}));
    expect(armorSetName(mixed)).toBe('Fermento Armor');
    expect(armorSetName([...mixed.slice(0, 3), {...mixed[3], id: 'SUPERIOR_DRAGON_HELMET', name: 'Superior Dragon Helmet'}])).toBeNull();
    expect(armorSetName(mixed.slice(0, 3))).toBeNull();
  });

  it('adds up the stat lines of the pieces, with the short names and the biggest first', () => {
    const armor = stats.gear.armor!;
    expect(armor.bonus.find(item => item.stat === 'Farming Fortune')).toEqual({stat: 'Farming Fortune', short: 'FrmFrt', value: 415});
    expect(armor.bonus.find(item => item.stat === 'Defense')).toMatchObject({short: 'Def', value: 480});
    expect(armor.bonus.find(item => item.stat === 'Health')).toMatchObject({short: 'HP', value: 720});
    expect(armor.bonus.find(item => item.stat === 'Bonus Pest Chance')).toMatchObject({short: 'BPC', value: 16});
    expect(armor.bonus.map(item => item.value)).toEqual([...armor.bonus.map(item => item.value)].sort((a, b) => b - a));
  });

  it('keeps unknown stats under their own name and ignores lines without a plus sign', () => {
    const equipment = stats.gear.equipment!;
    expect(equipment.setName).toBeNull();
    expect(equipment.bonus.find(item => item.stat === 'Pest Chance Cap')).toEqual({stat: 'Pest Chance Cap', short: 'Pest Chance Cap', value: 2});
    expect(equipment.bonus.some(item => item.stat === 'Gear Score')).toBe(false);
    expect(equipment.bonus.find(item => item.stat === 'Farming Fortune')?.value).toBe(150);
    expect(equipment.items.map(item => item.slot)).toEqual(['Necklace', 'Cloak', 'Belt', 'Gloves']);
  });

  it('reads item names and rarities without colour codes, stars and runes', () => {
    expect(stripFormatting('§6Mantid ✪✪✪ Boots §d➊')).toBe('Mantid Boots');
    expect(stats.gear.armor!.items[0]).toEqual({name: 'Mantid Fermento Boots', rarity: 'EPIC', slot: 'Boots'});
    expect(itemRarity(['§6§lLEGENDARY NECKLACE'])).toBe('LEGENDARY');
    expect(itemRarity(['§c§lVERY SPECIAL HELMET'])).toBe('SPECIAL');
    expect(itemRarity(['no rarity here'])).toBe('COMMON');
    expect(itemRarity([])).toBe('COMMON');
  });

  it('reads only the stat block at the top of the lore', () => {
    expect(itemStats(['§7Strength: §c+10', '§7Crit Damage: §9+25%', '', '§7Defense: §a+999'])).toEqual([{stat: 'Strength', value: 10}, {stat: 'Crit Damage', value: 25}]);
    expect(itemStats(['§7Health: §a+1,250 HP'])).toEqual([{stat: 'Health', value: 1250}]);
  });

  it('flags the Inventory API as off when there are no items to read', () => {
    const off = buildAccountStats({...base, member: profileFixture.member, bankBalance: null, gear: null});
    expect(off.gear).toEqual({inventoryApiOff: true, armor: null, equipment: null});
    expect(stats.gear.inventoryApiOff).toBe(false);
  });
});

describe('compact numbers', () => {
  it('writes 162.90M, 849.23M, 1.28M and 61.72K', () => {
    expect(formatCompact(162_900_000)).toBe('162.90M');
    expect(formatCompact(849_230_000)).toBe('849.23M');
    expect(formatCompact(1_280_000)).toBe('1.28M');
    expect(formatCompact(61_720)).toBe('61.72K');
    expect(formatCompact(2_500_000_000)).toBe('2.50B');
  });

  it('writes small numbers in full with thousands separators', () => {
    expect(formatCompact(9_999)).toBe('9,999');
    expect(formatCompact(110)).toBe('110');
    expect(formatCompact(0)).toBe('0');
  });
});
