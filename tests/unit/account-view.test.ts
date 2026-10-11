import {describe, expect, it} from 'vitest';
import profileFixture from '../fixtures/skyblock-profile.json';
import skillsFixture from '../fixtures/skyblock-skills.json';
import {accountCatalogLine, accountCardSchema, toAccountCard} from '../../src/lib/account-card';
import {accountInputSchema} from '../../src/lib/account-input';
import {eliteUrl, filterAccounts, rarityColor, skyCryptUrl, timeAgo} from '../../src/lib/account-view';
import {buildAccountStats, manualAccountStats, parseOptionalNumber, setSkillLevel, setSkyblockLevel, skillTableFromResource} from '../../src/lib/skyblock-stats';
import {defaultHypixelSettings, hypixelSettingsSchema, publicHypixelSettings, shelfSchema, defaultShelf, HYPIXEL_KEY, MINECRAFT_NAME} from '../../src/lib/accounts-shelf-rules';

const table = skillTableFromResource(skillsFixture);
const stats = buildAccountStats({table, member: profileFixture.member, bankBalance: profileFixture.bankBalance, profile: profileFixture.profile, fairySoulsTotal: 289, networth: profileFixture.networth, gear: profileFixture.gear, now: new Date('2026-10-11T00:00:00Z')});
const row = (over: Record<string, unknown> = {}) => ({id: 'a1', code: 'SB234567', ign: 'Farmer', showIgn: false, profileName: 'Mango', imagePaths: ['/api/product-images/img1'], status: 'available', stats, title: 'Farming 45', description: '', priceVnd: 5_000_000, salePriceVnd: null as number | null, ...over});

describe('account card', () => {
  it('summarises the snapshot and passes its own schema', () => {
    const card = toAccountCard(row());
    expect(card).toMatchObject({code: 'SB234567', level: 138, farmingLevel: 45, farmingMaxed: false, averageSkill: 30.3, networth: 849_230_000, purse: 162_900_000, setName: 'Fermento Armor', setRarity: 'EPIC', gameMode: 'ironman', imagePath: '/api/product-images/img1', status: 'available'});
    expect(card.farmingFill).toBeGreaterThan(0);
    expect(accountCardSchema.safeParse(card).success).toBe(true);
  });

  it('shows the IGN only when the Admin allowed it', () => {
    expect(toAccountCard(row()).ign).toBeNull();
    expect(toAccountCard(row({showIgn: true})).ign).toBe('Farmer');
    // The catalog line is public: the IGN must not appear anywhere in it unless allowed.
    expect(JSON.stringify(accountCatalogLine(row()))).not.toContain('Farmer');
    expect(JSON.stringify(accountCatalogLine(row({showIgn: true})))).toContain('Farmer');
  });

  it('copes with an account without stats and marks reserved ones as out of stock', () => {
    const card = toAccountCard(row({stats: null, imagePaths: []}));
    expect(card).toMatchObject({level: 0, farmingLevel: null, networth: null, setName: null, imagePath: '', gameMode: 'normal'});
    const reserved = accountCatalogLine(row({status: 'reserved'}));
    expect(reserved).toMatchObject({stock: 0, account: {status: 'reserved'}});
  });

  it('prices from the sale price when it is lower', () => {
    expect(accountCatalogLine(row({salePriceVnd: 4_000_000}))).toMatchObject({priceVnd: 4_000_000, basePriceVnd: 5_000_000, salePriceVnd: 4_000_000});
    expect(accountCatalogLine(row({salePriceVnd: 9_000_000}))).toMatchObject({priceVnd: 5_000_000, salePriceVnd: null});
  });
});

describe('shelf search and sort', () => {
  const lines = [
    accountCatalogLine(row({id: 'a', code: 'SB222222', title: 'Starter farm', priceVnd: 1_000_000, stats: manualAccountStats(table)})),
    accountCatalogLine(row({id: 'b', code: 'SB333333', title: 'Fermento farmer', priceVnd: 9_000_000})),
    accountCatalogLine(row({id: 'c', code: 'SB444444', title: 'Mid account', priceVnd: 4_000_000, showIgn: true, ign: 'Steve', stats: setSkillLevel(stats, 'FARMING', 50)}))
  ];

  it('searches the title, code, set and public IGN', () => {
    const ids = (query: string) => filterAccounts(lines, query, 'featured').map(line => line.id);
    expect(ids('')).toEqual(['a', 'b', 'c']);
    expect(ids('farm')).toEqual(['a', 'b']);
    expect(ids('sb333333')).toEqual(['b']);
    expect(ids('fermento armor')).toEqual(['b', 'c']);
    expect(ids('steve')).toEqual(['c']);
    // A hidden IGN is not searchable either.
    expect(ids('farmer sb')).toEqual(['b']);
  });

  it('sorts by price, networth and Farming level', () => {
    const ids = (sort: Parameters<typeof filterAccounts>[2]) => filterAccounts(lines, '', sort).map(line => line.id);
    expect(ids('price-low')).toEqual(['a', 'c', 'b']);
    expect(ids('price-high')).toEqual(['b', 'c', 'a']);
    expect(ids('farming')[0]).toBe('c');
    expect(ids('networth').at(-1)).toBe('a');
  });
});

describe('editing by hand', () => {
  const blank = manualAccountStats(table, new Date('2026-10-11T00:00:00Z'));

  it('sets a skill level within its cap and keeps the average in step', () => {
    let next = setSkillLevel(blank, 'FARMING', 45);
    expect(next.skills.find(skill => skill.key === 'FARMING')).toMatchObject({level: 45, maxed: false, xpNext: null});
    next = setSkillLevel(next, 'MINING', 35);
    expect(next.summary.averageSkill).toBe(8);
    expect(setSkillLevel(next, 'FARMING', 999).skills.find(skill => skill.key === 'FARMING')).toMatchObject({level: 60, maxed: true});
    expect(setSkillLevel(next, 'FARMING', -3).skills.find(skill => skill.key === 'FARMING')?.level).toBe(0);
    expect(setSkillLevel(next, 'SOCIAL', 20).summary.averageSkill).toBe(8);
  });

  it('sets the SkyBlock level and reads optional numbers', () => {
    expect(setSkyblockLevel(blank, 138).level).toEqual({level: 138, xp: 0, next: 100});
    expect(parseOptionalNumber('')).toBeNull();
    expect(parseOptionalNumber(' 1,250 ')).toBe(1250);
    expect(parseOptionalNumber('-5')).toBeNull();
    expect(parseOptionalNumber('abc')).toBeNull();
  });
});

describe('what an Admin may send', () => {
  const valid = {ign: 'Farmer_01', showIgn: true, title: 'Farming 45', priceVnd: 5_000_000};

  it('accepts a minimal account and fills defaults', () => {
    expect(accountInputSchema.parse(valid)).toMatchObject({status: 'draft', imagePaths: [], statsSource: 'manual', statsLocked: false, description: ''});
    expect(accountInputSchema.parse({...valid, stats}).stats?.level.level).toBe(138);
  });

  it('refuses a bad name, extra fields, foreign image paths, too many screenshots and statuses set by orders', () => {
    expect(accountInputSchema.safeParse({...valid, ign: 'no spaces allowed'}).success).toBe(false);
    expect(accountInputSchema.safeParse({...valid, status: 'sold'}).success).toBe(false);
    expect(accountInputSchema.safeParse({...valid, secretEnc: 'x'}).success).toBe(false);
    expect(accountInputSchema.safeParse({...valid, imagePaths: ['https://evil.example/x.png']}).success).toBe(false);
    expect(accountInputSchema.safeParse({...valid, imagePaths: Array.from({length: 9}, (_, i) => `/api/product-images/img${i}`)}).success).toBe(false);
    expect(accountInputSchema.safeParse({...valid, priceVnd: -1}).success).toBe(false);
  });
});

describe('settings, links and small helpers', () => {
  it('never hands the Hypixel key to the browser', () => {
    const settings = hypixelSettingsSchema.parse({...defaultHypixelSettings, apiKeyEnc: 'sealed.key.data', apiKeyTail: 'abcd'});
    const view = publicHypixelSettings(settings);
    expect(view).toEqual({hasKey: true, keyTail: 'abcd', autoRefreshHours: 12, fairySoulsTotal: 289});
    expect(JSON.stringify(view)).not.toContain('sealed');
    expect(hypixelSettingsSchema.safeParse({...defaultHypixelSettings, autoRefreshHours: 7}).success).toBe(false);
  });

  it('checks the shelf words and key formats', () => {
    expect(shelfSchema.safeParse(defaultShelf).success).toBe(true);
    expect(shelfSchema.safeParse({...defaultShelf, accountsTabLabel: ''}).success).toBe(false);
    expect(HYPIXEL_KEY.test('069a79f4-44e9-4726-a5be-fca90e38aaf5')).toBe(true);
    expect(HYPIXEL_KEY.test('not-a-key')).toBe(false);
    expect(MINECRAFT_NAME.test('Steve_1')).toBe(true);
    expect(MINECRAFT_NAME.test('ab')).toBe(false);
  });

  it('builds SkyCrypt and Elite links and rarity colours', () => {
    expect(skyCryptUrl('Steve', 'Mango')).toBe('https://sky.shiiyu.moe/stats/Steve/Mango');
    expect(eliteUrl('Steve', 'Mango')).toBe('https://elitebot.dev/@Steve/Mango');
    expect(skyCryptUrl('Steve', null)).toBe('https://sky.shiiyu.moe/stats/Steve');
    expect(rarityColor('LEGENDARY')).toBe('#ffaa00');
    expect(rarityColor('nonsense')).toBe('#ffffff');
  });

  it('says how long ago something happened', () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    expect(timeAgo('2026-10-11T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-10-11T11:00:00Z', now)).toBe('1 hour ago');
    expect(timeAgo('2026-10-11T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2024-10-11T12:00:00Z', now)).toBe('2 years ago');
    expect(timeAgo(null, now)).toBeNull();
  });
});
