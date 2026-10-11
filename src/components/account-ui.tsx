'use client';
import Link from 'next/link';
import type {ReactNode} from 'react';
import type {CatalogProduct} from '@/lib/catalog';
import {rarityColor, timeAgo} from '@/lib/account-view';
import {formatCompact, GAME_MODES, skillFill, statColor, type AccountStats, type GearGroup, type SkillStat} from '@/lib/skyblock-stats';
import Price from './price';

// The pieces of a SkyBlock account that the shelf, the account page and the Admin preview all share.

const SKILL_ICONS: Record<string, string> = {ALCHEMY: '⚗️', CARPENTRY: '🪚', COMBAT: '⚔️', ENCHANTING: '📖', FARMING: '🌾', FISHING: '🎣', FORAGING: '🌲', HUNTING: '🏹', MINING: '⛏️', RUNECRAFTING: '🔮', SOCIAL: '💬', TAMING: '🐾'};
const modeLabel = (mode: string) => GAME_MODES[mode] ?? mode;
const num = (value: number | null | undefined, fallback = '—') => value === null || value === undefined ? fallback : formatCompact(value);

function Bar({fill, maxed, label}: {fill: number; maxed: boolean; label: string}) {
  return <span className={`sb-bar ${maxed ? 'maxed' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill * 100)}><i style={{width: `${Math.round(fill * 100)}%`}}/></span>;
}

function Info({text}: {text: string}) {
  return <span className="sb-info" tabIndex={0} role="img" aria-label={text} title={text}>i</span>;
}

// ---------- The card on the shelf ----------

export function AccountCardTile({product, vndPerUsd, vndPerLtc = null, href, preview = false}: {product: CatalogProduct; vndPerUsd: number; vndPerLtc?: number | null; href: string; preview?: boolean}) {
  const card = product.account;
  if (!card) return null;
  const reserved = card.status === 'reserved';
  const farming = card.farmingLevel;
  return <article className={`sb-card ${reserved ? 'is-reserved' : ''}`} aria-label={product.title.en}>
    <div className="sb-card-media">
      {product.imagePath ? <img loading="lazy" decoding="async" src={product.imagePath} alt={`Screenshot of ${product.title.en}`}/> : <div className="sb-card-level" aria-hidden="true"><small>SKYBLOCK LEVEL</small><strong>{card.level}</strong></div>}
      {reserved && <span className="sb-ribbon">Reserved</span>}
      {card.gameMode !== 'normal' && <span className="sb-mode">{modeLabel(card.gameMode)}</span>}
    </div>
    <div className="sb-card-body">
      <p className="sb-code">{product.sku}</p>
      <h3>{product.title.en}</h3>
      <p className="sb-sub">{[card.profileName, card.ign].filter(Boolean).join(' · ') || 'Hypixel SkyBlock'}</p>
      <dl className="sb-facts">
        <div><dt>Level</dt><dd>{card.level}</dd></div>
        <div><dt>Farming</dt><dd>{farming ?? '—'}{farming !== null && <Bar fill={card.farmingFill} maxed={card.farmingMaxed} label="Farming progress"/>}</dd></div>
        <div><dt>Networth</dt><dd>{num(card.networth)}</dd></div>
        <div><dt>Purse</dt><dd>{num(card.purse)}</dd></div>
      </dl>
      {card.setName && <p className="sb-set" style={{color: rarityColor(card.setRarity)}}><span aria-hidden="true">✦</span> {card.setName}</p>}
      <div className="sb-bottom">
        <div>{product.salePriceVnd && <del>{product.basePriceVnd.toLocaleString('en-US')} ₫</del>}<Price vnd={product.priceVnd} vndPerUsd={vndPerUsd} vndPerLtc={vndPerLtc}/></div>
        {preview ? <span className="button disabled-link" aria-disabled="true">View account →</span>
          : reserved ? <span className="button disabled-link" aria-disabled="true">Reserved</span>
          : <Link className="button" href={href}>View account <span aria-hidden="true">→</span></Link>}
      </div>
    </div>
  </article>;
}

// ---------- The stats on the account page ----------

function SkillCell({skill}: {skill: SkillStat}) {
  const text = skill.maxed ? `${formatCompact(skill.totalXp)} XP` : skill.xpNext ? `${formatCompact(skill.xpInto)} / ${formatCompact(skill.xpNext)} XP` : '';
  return <li className={`sb-skill ${skill.maxed ? 'maxed' : ''}`}>
    <span className="sb-skill-icon" aria-hidden="true">{SKILL_ICONS[skill.key] ?? '✦'}</span>
    <div><div className="sb-skill-head"><strong>{skill.label}</strong><span>{skill.level}{skill.maxed ? <small> MAX</small> : null}</span></div>
      <Bar fill={skillFill(skill)} maxed={skill.maxed} label={`${skill.label} progress`}/>
      {text && <small className="sb-skill-xp">{text}</small>}</div>
  </li>;
}

const GEAR_PATHS: Record<string, string> = {
  Helmet: 'M5 13a7 7 0 0 1 14 0v6h-4v-4H9v4H5z', Chestplate: 'M7 4h10l3 3v5l-3 1v7H7v-7l-3-1V7z', Leggings: 'M7 3h10l1 18h-5l-1-9-1 9H6z', Boots: 'M8 3h6v10l6 3v5H4v-5l4-2z',
  Necklace: 'M5 4c0 8 3 12 7 12s7-4 7-12M12 16v3m-2 0h4', Cloak: 'M8 3h8l4 17H4z', Belt: 'M3 9h18v6H3zM10 9v6h4V9', Gloves: 'M8 21v-8L6 9V6l2 1 1-4 2 1 1-1 1 2 2 1v6l-2 3v7z'
};

function GearBlock({title, group, empty}: {title: string; group: GearGroup | null; empty: string}) {
  return <div className="sb-gear-group"><h3>{title}</h3>
    {!group ? <p className="muted">{empty}</p> : <>
      {group.setName && <p className="sb-set-name">Set: <strong>{group.setName}</strong></p>}
      {group.bonus.length > 0 && <p className="sb-bonus">Bonus: {group.bonus.map(item => <span key={item.stat} style={{color: statColor(item.short)}} title={`${item.stat} +${item.value}`}>{item.short} +{formatCompact(item.value)}</span>)}</p>}
      <ul className="sb-gear">{group.items.map(item => <li key={`${item.slot}-${item.name}`} title={`${item.name} · ${item.rarity.toLowerCase()}`}>
        <span className="sb-gear-box" style={{background: rarityColor(item.rarity)}} role="img" aria-label={`${item.slot}: ${item.name}, ${item.rarity.toLowerCase()}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={GEAR_PATHS[item.slot] ?? GEAR_PATHS.Helmet}/></svg></span>
        <small>{item.name}</small>
      </li>)}</ul></>}
  </div>;
}

export function AccountStatsView({stats}: {stats: AccountStats}) {
  const {summary} = stats;
  const rows: [string, ReactNode, string][] = [
    ['Joined', timeAgo(summary.joinedAt) ?? '—', 'When this SkyBlock profile was created.'],
    ['Purse', num(summary.purse), 'Coins the player carries.'],
    ['Bank Account', summary.bank === null ? 'API off' : num(summary.bank), 'Coins in the profile bank. “API off” means the player has the banking API switched off.'],
    ['Average Skill Level', summary.averageSkill ? summary.averageSkill.toFixed(2) : '—', 'The average of the ten main skills. Runecrafting and Social are not counted.'],
    ['Fairy Souls', summary.fairySouls ? `${summary.fairySouls.collected} / ${summary.fairySouls.total}` : '—', 'Fairy souls collected, out of all of them.'],
    ['Networth', num(summary.networth), 'An estimate of the value of all items and coins from public market prices. It can differ a little from other websites.'],
    ['Non-Cosmetic Networth', num(summary.nonCosmeticNetworth), 'The same estimate without cosmetic items such as skins and dyes.']
  ];
  return <div className="sb-stats">
    <section className="card sb-block sb-level"><div className="sb-level-head"><h2>SkyBlock Level</h2><strong>{stats.level.level}</strong></div>
      <Bar fill={stats.level.xp / stats.level.next} maxed={false} label="SkyBlock level progress"/><small className="muted">{stats.level.xp} / {stats.level.next} XP</small></section>
    <section className="card sb-block"><h2>Skills</h2><ul className="sb-skills">{stats.skills.map(skill => <SkillCell key={skill.key} skill={skill}/>)}</ul></section>
    <section className="card sb-block"><h2>Summary</h2><dl className="sb-summary">{rows.map(([label, value, hint]) => <div key={label}><dt>{label} <Info text={hint}/></dt><dd>{value}</dd></div>)}</dl></section>
    <section className="card sb-block"><h2>Gear</h2>
      {stats.gear.inventoryApiOff ? <p className="muted">The player has the Inventory API switched off, so armor and equipment are not shown.</p> : <div className="sb-gear-groups">
        <GearBlock title="Armor" group={stats.gear.armor} empty="No armor equipped."/>
        <GearBlock title="Equipment" group={stats.gear.equipment} empty="No equipment."/>
      </div>}
    </section>
  </div>;
}
