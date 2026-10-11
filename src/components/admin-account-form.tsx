'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useLocale} from 'next-intl';
import {accountCatalogLine} from '@/lib/account-card';
import {MAX_ACCOUNT_IMAGES, LOGIN_TEMPLATE} from '@/lib/account-input';
import {accountStatusLabels, accountStatusTone, statusProblem, type AccountStatus, type AdminStatus} from '@/lib/account-rules';
import {timeAgo} from '@/lib/account-view';
import {uploadImage} from '@/lib/image-upload';
import {formatUsdFromVnd} from '@/lib/money';
import {GAME_MODES, parseOptionalNumber, setSkillLevel, setSkyblockLevel, suggestTitle, type AccountStats} from '@/lib/skyblock-stats';
import {LoadingRows} from './loading-state';
import {AccountCardTile, AccountStatsView} from './account-ui';

type Loaded = {id: string; code: string; ign: string; uuid: string | null; profileId: string | null; profileName: string | null; showIgn: boolean; title: string; description: string; priceVnd: number; salePriceVnd: number | null; sortOrder: number; imagePaths: string[];
  stats: AccountStats | null; statsSource: 'hypixel' | 'manual'; statsLocked: boolean; statsFetchedAt: string | null; statsError: string | null; status: AccountStatus; adminNote: string | null; hasLogin: boolean; loginReadable: boolean};
type Profile = {id: string; cuteName: string | null; gameMode: string; selected: boolean; lastSave: number | null};
type Meta = {vndPerUsd: number; hypixel: {hasKey: boolean}; showIgnByDefault: boolean};
type Form = {ign: string; uuid: string | null; profileId: string | null; profileName: string | null; showIgn: boolean; title: string; description: string; price: string; salePrice: string; sortOrder: string; imagePaths: string[];
  stats: AccountStats | null; statsSource: 'hypixel' | 'manual'; statsLocked: boolean; login: string; adminNote: string; status: AdminStatus};

const blank = (showIgn: boolean): Form => ({ign: '', uuid: null, profileId: null, profileName: null, showIgn, title: '', description: '', price: '', salePrice: '', sortOrder: '0', imagePaths: [], stats: null, statsSource: 'manual', statsLocked: false, login: LOGIN_TEMPLATE, adminNote: '', status: 'draft'});
const fromLoaded = (account: Loaded): Form => ({ign: account.ign, uuid: account.uuid, profileId: account.profileId, profileName: account.profileName, showIgn: account.showIgn, title: account.title, description: account.description, price: String(account.priceVnd), salePrice: account.salePriceVnd ? String(account.salePriceVnd) : '',
  sortOrder: String(account.sortOrder), imagePaths: account.imagePaths, stats: account.stats, statsSource: account.statsSource, statsLocked: account.statsLocked, login: '', adminNote: account.adminNote ?? '', status: account.status === 'available' || account.status === 'hidden' ? account.status : 'draft'});

async function call(url: string, init?: {method?: string; body?: unknown}) {
  const response = await fetch(url, {method: init?.method ?? 'GET', cache: 'no-store', ...(init?.body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(init.body)} : {})});
  const data = await response.json().catch(() => ({}));
  if (response.status === 403) { window.location.assign(`/en/login?next=${encodeURIComponent(window.location.pathname)}`); throw new Error('Your Admin session ended.'); }
  if (!response.ok) throw new Error(data.error ?? 'The request failed.');
  return data;
}

/** Adds or edits one game account: find it by IGN, check the preview exactly as customers will see it, set the price, hand over the login. */
export default function AdminAccountForm({id}: {id?: string}) {
  const locale = useLocale();
  const router = useRouter();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [profiles, setProfiles] = useState<{uuid: string; ign: string; list: Profile[]} | null>(null);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const dragged = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([call('/api/admin/accounts?meta=1'), id ? call(`/api/admin/accounts/${id}`) : null]).then(([metaData, accountData]) => {
      if (!active) return;
      setMeta(metaData);
      if (accountData) { setLoaded(accountData.account); setForm(fromLoaded(accountData.account)); } else setForm(blank(metaData.showIgnByDefault));
    }).catch(cause => active && setError(cause instanceof Error ? cause.message : 'The page could not be loaded.'));
    return () => { active = false; };
  }, [id]);

  const editable = !loaded || ['draft', 'available', 'hidden'].includes(loaded.status);
  const set = (patch: Partial<Form>) => setForm(current => current && {...current, ...patch});
  /** A number edited by hand freezes the snapshot so the automatic refresh does not overwrite it. */
  const editStats = (next: AccountStats) => set({stats: {...next, source: 'manual'}, statsSource: 'manual', statsLocked: true});
  const run = async (name: string, work: () => Promise<void>) => { setBusy(name); setError(''); setMessage(''); try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.'); } finally { setBusy(''); } };

  const preview = useMemo(() => {
    if (!form) return null;
    const price = Number(form.price) || 0; const sale = Number(form.salePrice) || null;
    return accountCatalogLine({id: loaded?.id ?? 'preview', code: loaded?.code ?? 'SB••••••', ign: form.ign || 'Player', showIgn: form.showIgn, profileName: form.profileName ?? form.stats?.profile.cuteName ?? null, imagePaths: form.imagePaths, status: 'available', stats: form.stats, title: form.title || 'Untitled account', description: form.description, priceVnd: price, salePriceVnd: sale});
  }, [form, loaded]);

  if (!form || !meta || !preview) return <div className="page-heading"><Link href={`/${locale}/admin/accounts`}>← Accounts</Link>{error ? <p className="admin-feedback error" role="alert">{error}</p> : <LoadingRows label="Loading account…"/>}</div>;
  const keyMissing = !meta.hypixel.hasKey;
  const priceNumber = Number(form.price);

  const lookup = () => run('lookup', async () => {
    const data = await call(id ? `/api/admin/accounts/${id}` : '/api/admin/accounts', {method: 'POST', body: {action: 'lookup', ign: form.ign.trim()}});
    setProfiles({uuid: data.uuid, ign: data.ign, list: data.profiles});
    const pick = data.profiles.find((item: Profile) => item.selected) ?? data.profiles[0];
    setChosen(pick.id);
    set({ign: data.ign, uuid: data.uuid});
    setMessage(data.profiles.length > 1 ? 'This player has several profiles. Pick one, then load its stats.' : 'Found the player. Load the stats of the profile below.');
  });
  const loadStats = () => run('preview', async () => {
    if (!profiles) return;
    const data = await call('/api/admin/accounts', {method: 'POST', body: {action: 'preview', uuid: profiles.uuid, profileId: chosen}});
    const stats = data.stats as AccountStats;
    set({ign: profiles.ign, uuid: profiles.uuid, profileId: chosen, profileName: stats.profile.cuteName, stats, statsSource: 'hypixel', statsLocked: false, ...(form.title.trim() ? {} : {title: suggestTitle(stats)})});
    setMessage(`Stats loaded from Hypixel${data.remaining !== null ? ` (${data.remaining} Hypixel requests left this minute)` : ''}. Check the preview, then save.`);
  });
  const manual = () => run('manual', async () => {
    const data = await call('/api/admin/accounts', {method: 'POST', body: {action: 'blank-stats'}});
    set({stats: data.stats, statsSource: 'manual', statsLocked: true});
    setMessage('Fill in the numbers below the preview.');
  });
  const refresh = () => run('refresh', async () => {
    const data = await call(`/api/admin/accounts/${id}`, {method: 'POST', body: {action: 'fetch-stats', ...(profiles ? {uuid: profiles.uuid, profileId: chosen} : {})}});
    setLoaded(data.account); setForm(current => current && {...current, stats: data.account.stats, statsSource: 'hypixel', statsLocked: false, profileName: data.account.profileName, profileId: data.account.profileId, uuid: data.account.uuid, ign: data.account.ign});
    setMessage('Stats refreshed from Hypixel.');
  });
  const reveal = () => { if (!window.confirm('Show the saved login details on this screen? This is recorded in Activity.')) return; void run('reveal', async () => { setRevealed((await call(`/api/admin/accounts/${id}`, {method: 'POST', body: {action: 'reveal-secret'}})).login); }); };
  const upload = (files: FileList | null) => run('upload', async () => {
    const added: string[] = [];
    for (const file of Array.from(files ?? [])) {
      if (form.imagePaths.length + added.length >= MAX_ACCOUNT_IMAGES) throw new Error(`At most ${MAX_ACCOUNT_IMAGES} screenshots.`);
      const {path} = await uploadImage(file);
      if (!form.imagePaths.includes(path) && !added.includes(path)) added.push(path);
    }
    if (fileInput.current) fileInput.current.value = '';
    set({imagePaths: [...form.imagePaths, ...added]});
  });
  const moveImage = (from: number, to: number) => { if (to < 0 || to >= form.imagePaths.length || from === to) return; const next = [...form.imagePaths]; next.splice(to, 0, next.splice(from, 1)[0]); set({imagePaths: next}); };

  const payload = () => ({ign: form.ign.trim(), uuid: form.uuid, profileId: form.profileId, profileName: form.profileName, showIgn: form.showIgn, title: form.title, description: form.description, priceVnd: Number.isFinite(priceNumber) ? priceNumber : 0, salePriceVnd: form.salePrice ? Number(form.salePrice) : null,
    sortOrder: Number(form.sortOrder) || 0, imagePaths: form.imagePaths, stats: form.stats, statsSource: form.statsSource, statsLocked: form.statsLocked, ...(form.login.trim() && form.login.trim() !== LOGIN_TEMPLATE.trim() ? {login: form.login} : {}), adminNote: form.adminNote, status: form.status});
  const save = (event: React.FormEvent) => { event.preventDefault(); void run('save', async () => {
    const problem = editable && form.status === 'available' ? statusProblem({status: loaded?.status ?? 'draft', priceVnd: priceNumber, salePriceVnd: form.salePrice ? Number(form.salePrice) : null, hasLogin: Boolean(loaded?.hasLogin || (form.login.trim() && form.login.trim() !== LOGIN_TEMPLATE.trim()))}, 'available') : null;
    if (problem) throw new Error(problem);
    if (id) {
      const data = await call(`/api/admin/accounts/${id}`, {method: 'POST', body: {action: 'save', account: payload()}});
      setLoaded(data.account); setForm(fromLoaded(data.account)); setReplacing(false); setRevealed(null); setMessage('Saved.');
    } else {
      const created = await call('/api/admin/accounts', {method: 'POST', body: {action: 'create', account: payload()}});
      router.push(`/${locale}/admin/accounts/${created.id}`);
    }
  }); };
  const quickStatus = (status: AdminStatus) => run('status', async () => { const data = await call(`/api/admin/accounts/${id}`, {method: 'POST', body: {action: 'set-status', status}}); setLoaded(data.account); setForm(current => current && {...current, status}); setMessage(`Now ${accountStatusLabels[status].toLowerCase()}.`); });
  const remove = () => { if (!window.confirm('Delete this account for good?')) return; void run('delete', async () => { await call('/api/admin/accounts', {method: 'DELETE', body: {id}}); router.push(`/${locale}/admin/accounts`); }); };

  const stats = form.stats;
  const numberField = (label: string, value: number | null, apply: (value: number | null) => void) => <label key={label}>{label}<input type="text" inputMode="decimal" value={value ?? ''} onChange={event => apply(parseOptionalNumber(event.target.value))}/></label>;
  const input = (label: string, key: 'title' | 'ign' | 'sortOrder', extra?: React.InputHTMLAttributes<HTMLInputElement>) => <label>{label}<input value={form[key]} disabled={!editable} onChange={event => set({[key]: event.target.value})} {...extra}/></label>;

  return <div className="admin-account-form">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/accounts`}>ADMIN / ACCOUNTS</Link> / {loaded?.code ?? 'NEW'}</p><h1>{loaded ? loaded.title : 'Add a SkyBlock account'}</h1>
      {loaded && <p className="admin-lede"><span className={`badge ${accountStatusTone[loaded.status]}`}>{accountStatusLabels[loaded.status]}</span> {loaded.code}{loaded.status === 'available' && <> · <Link href={`/${locale}/accounts/${loaded.code}`} target="_blank">View on the store</Link></>}</p>}</div>
      {loaded && editable && <div className="form-actions">{loaded.status !== 'available' && <button type="button" disabled={Boolean(busy)} onClick={() => void quickStatus('available')}>Put on sale</button>}{loaded.status === 'available' && <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void quickStatus('hidden')}>Take off sale</button>}</div>}</div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}
    {!editable && <p className="notice">This account is {accountStatusLabels[loaded!.status].toLowerCase()}, so its price, login and stats are kept as they were. You can still write a private note.</p>}

    <form onSubmit={save}>
      <section className="card admin-panel"><h2>1 · Find the account</h2>
        <div className="admin-field-row">{input('In-game name (IGN)', 'ign', {required: true, maxLength: 16, autoComplete: 'off', spellCheck: false})}
          <div className="form-actions"><button type="button" disabled={!editable || keyMissing || !form.ign.trim() || Boolean(busy)} onClick={() => void lookup()}>{busy === 'lookup' ? 'Looking…' : 'Fetch stats'}</button>{!id && <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void manual()}>Enter stats manually</button>}</div></div>
        {keyMissing && <p className="field-caption">Add your Hypixel API key in <Link href={`/${locale}/admin/settings/accounts`}>Settings → SkyBlock accounts</Link> to fetch stats. Until then, enter them by hand.</p>}
        {profiles && <fieldset className="rate-mode"><legend>SkyBlock profile of {profiles.ign}</legend>{profiles.list.map(item => <label key={item.id}><input type="radio" name="profile" checked={chosen === item.id} onChange={() => setChosen(item.id)}/><span><strong>{item.cuteName ?? 'Profile'}</strong><small>{GAME_MODES[item.gameMode] ?? item.gameMode}{item.selected ? ' · in use' : ''}{item.lastSave ? ` · last played ${timeAgo(new Date(item.lastSave).toISOString())}` : ''}</small></span></label>)}
          <div className="form-actions"><button type="button" disabled={!chosen || Boolean(busy)} onClick={() => void loadStats()}>{busy === 'preview' ? 'Loading…' : 'Load stats of this profile'}</button></div></fieldset>}
        {id && editable && form.uuid && !keyMissing && <div className="form-actions"><button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void refresh()}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh stats'}</button><small className="admin-subtle">{loaded?.statsFetchedAt ? `Last updated ${timeAgo(loaded.statsFetchedAt)}` : 'Never fetched'}{form.statsLocked ? ' · locked: edited by hand, not refreshed automatically' : ''}</small></div>}
        {loaded?.statsError && <p className="admin-feedback error">The last automatic refresh failed: {loaded.statsError}</p>}
        {stats?.gear.inventoryApiOff && form.statsSource === 'hypixel' && <p className="notice">The player’s Inventory API is off, so armor and equipment are missing. Switch on the Inventory API in the game (Settings → API Settings), then press Refresh stats.</p>}
      </section>

      <section className="card admin-panel"><h2>2 · Preview</h2><p className="field-caption">This is the card customers see in the store, and below it the account page.</p>
        <div className="sb-grid" style={{maxWidth: 380}}><AccountCardTile product={preview} vndPerUsd={meta.vndPerUsd} href="#" preview/></div>
        {stats ? <div style={{marginTop: 16}}><AccountStatsView stats={stats}/></div> : <p className="admin-empty">No stats yet: fetch them from Hypixel or enter them by hand.</p>}
      </section>

      {stats && editable && <details className="card admin-panel" open={form.statsSource === 'manual'}><summary><strong>Edit the numbers by hand</strong> <small className="admin-subtle">Saving a manual number locks the stats so Hypixel does not overwrite them.</small></summary>
        <div className="admin-field-row">{numberField('SkyBlock level', stats.level.level, value => editStats(setSkyblockLevel(stats, value ?? 0)))}
          <label>Game mode<select value={stats.profile.gameMode} onChange={event => editStats({...stats, profile: {...stats.profile, gameMode: event.target.value}})}>{Object.entries(GAME_MODES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Profile name<input value={stats.profile.cuteName ?? ''} maxLength={60} onChange={event => { editStats({...stats, profile: {...stats.profile, cuteName: event.target.value || null}}); set({profileName: event.target.value || null}); }}/></label></div>
        <h3>Skill levels</h3><div className="admin-field-row">{stats.skills.map(skill => numberField(`${skill.label} (max ${skill.cap})`, skill.level, value => editStats(setSkillLevel(stats, skill.key, value ?? 0))))}</div>
        <h3>Summary</h3><div className="admin-field-row">
          {numberField('Purse', stats.summary.purse, value => editStats({...stats, summary: {...stats.summary, purse: value}}))}
          {numberField('Bank (empty = API off)', stats.summary.bank, value => editStats({...stats, summary: {...stats.summary, bank: value}}))}
          {numberField('Networth', stats.summary.networth, value => editStats({...stats, summary: {...stats.summary, networth: value}}))}
          {numberField('Non-cosmetic networth', stats.summary.nonCosmeticNetworth, value => editStats({...stats, summary: {...stats.summary, nonCosmeticNetworth: value}}))}
          {numberField('Fairy souls collected', stats.summary.fairySouls?.collected ?? null, value => editStats({...stats, summary: {...stats.summary, fairySouls: value === null ? null : {collected: Math.floor(value), total: Math.max(Math.floor(value), stats.summary.fairySouls?.total ?? 289)}}}))}
        </div><p className="field-caption">The average skill level is worked out from the skill levels.</p></details>}

      <section className="card admin-panel"><h2>3 · Title, price and what customers see</h2>
        {input('Title', 'title', {required: true, maxLength: 120})}
        {stats && !form.title.trim() && <button type="button" className="secondary" onClick={() => set({title: suggestTitle(stats)})}>Suggest a title</button>}
        <label>Description (optional)<textarea rows={4} maxLength={4000} value={form.description} disabled={!editable} onChange={event => set({description: event.target.value})}/></label>
        <div className="admin-field-row">
          <label>Price (VND)<input type="number" min="0" step="1000" value={form.price} disabled={!editable} onChange={event => set({price: event.target.value})} required/><small className="field-caption">{priceNumber > 0 ? `≈ ${formatUsdFromVnd(priceNumber, meta.vndPerUsd)} at the current rate` : 'Customers see the price in USD first.'}</small></label>
          <label>Sale price (VND, optional)<input type="number" min="0" step="1000" value={form.salePrice} disabled={!editable} onChange={event => set({salePrice: event.target.value})}/><small className="field-caption">{Number(form.salePrice) > 0 ? `≈ ${formatUsdFromVnd(Number(form.salePrice), meta.vndPerUsd)}` : 'Must be lower than the price.'}</small></label>
          {input('Sort order', 'sortOrder', {type: 'number', step: '1'})}
        </div>
        <label className="admin-compact-check"><input type="checkbox" checked={form.showIgn} disabled={!editable} onChange={event => set({showIgn: event.target.checked})}/> Show IGN to customers (adds “View on SkyCrypt” and “Elite” links). When off, the name is only given with the login details after payment.</label>
      </section>

      <section className="card admin-panel"><h2>4 · Screenshots</h2><p className="field-caption">Up to {MAX_ACCOUNT_IMAGES}. The first one is the cover on the store. Drag to reorder, or use the arrows.</p>
        <ul className="admin-image-list">{form.imagePaths.map((path, index) => <li key={path} draggable={editable} onDragStart={() => { dragged.current = index; }} onDragOver={event => event.preventDefault()} onDrop={() => { if (dragged.current !== null) moveImage(dragged.current, index); dragged.current = null; }}>
          <img src={path} alt={`Screenshot ${index + 1}`}/>
          <span><button type="button" className="secondary" aria-label="Move earlier" disabled={!editable || index === 0} onClick={() => moveImage(index, index - 1)}>◀</button><button type="button" className="secondary" aria-label="Move later" disabled={!editable || index === form.imagePaths.length - 1} onClick={() => moveImage(index, index + 1)}>▶</button><button type="button" className="admin-remove-link" disabled={!editable} onClick={() => set({imagePaths: form.imagePaths.filter(item => item !== path)})}>Remove</button></span></li>)}</ul>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={!editable || form.imagePaths.length >= MAX_ACCOUNT_IMAGES || Boolean(busy)} onChange={event => void upload(event.target.files)}/>
      </section>

      <section className="card admin-panel"><h2>5 · Login details</h2>
        <p className="field-caption">Saved encrypted. The customer sees them on their order page only after the payment is confirmed. They are never in an email.</p>
        {loaded?.hasLogin && !replacing && <div className="admin-login-saved"><strong>••• saved</strong>{!loaded.loginReadable && <span className="error-text"> The saved details cannot be opened (AUTH_SECRET changed?). Replace them.</span>}
          {revealed !== null && <textarea readOnly rows={5} className="admin-mono" value={revealed}/>}
          <div className="form-actions">{revealed === null ? <button type="button" className="secondary" disabled={!editable || Boolean(busy)} onClick={reveal}>Reveal</button> : <button type="button" className="secondary" onClick={() => setRevealed(null)}>Hide</button>}<button type="button" className="secondary" disabled={!editable} onClick={() => { setReplacing(true); set({login: LOGIN_TEMPLATE}); }}>Replace</button></div></div>}
        {(!loaded?.hasLogin || replacing) && <label>Login details<textarea rows={5} className="admin-mono" maxLength={4000} value={form.login} disabled={!editable} onChange={event => set({login: event.target.value})} autoComplete="off"/></label>}
      </section>

      <section className="card admin-panel"><h2>6 · Status</h2>
        <div className="admin-field-row"><label>Status<select value={form.status} disabled={!editable} onChange={event => set({status: event.target.value as AdminStatus})}><option value="draft">Draft (not for sale)</option><option value="available">Available (on sale)</option><option value="hidden">Hidden</option></select></label>
          <label>Private note (customers never see it)<input value={form.adminNote} maxLength={1000} onChange={event => set({adminNote: event.target.value})}/></label></div>
        <div className="form-actions"><button type="submit" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : id ? 'Save changes' : 'Create account'}</button>
          {id && loaded && !['reserved', 'sold'].includes(loaded.status) && <button type="button" className="admin-remove-link" disabled={Boolean(busy)} onClick={remove}>Delete account</button>}</div>
      </section>
    </form>
  </div>;
}
