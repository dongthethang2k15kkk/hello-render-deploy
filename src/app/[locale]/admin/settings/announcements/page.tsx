'use client';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import AnnouncementCarousel from '@/components/announcement-carousel';
import {MAX_SLIDES, type Announcements, type Slide} from '@/lib/announcement-rules';
import {uploadImage} from '@/lib/image-upload';

export default function AnnouncementSettings() {
  const locale = useLocale();
  const [state, setState] = useState<Announcements | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/settings/announcements', {cache: 'no-store'}).then(async response => {
      if (response.status === 403) { window.location.assign(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body);
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Announcements could not be loaded.'));
  }, [locale]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(next: Announcements) { setState(next); setDirty(true); setMessage(''); }
  const updateSlide = (index: number, patch: Partial<Slide>) => state && change({...state, slides: state.slides.map((slide, i) => i === index ? {...slide, ...patch} : slide)});
  const move = (index: number, delta: number) => {
    if (!state) return;
    const slides = [...state.slides]; const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    [slides[index], slides[target]] = [slides[target], slides[index]];
    change({...state, slides});
  };

  async function addFiles(files: FileList | null) {
    if (!files?.length || !state) return;
    const room = MAX_SLIDES - state.slides.length;
    if (room <= 0) { setError(`Use at most ${MAX_SLIDES} images.`); return; }
    setBusy(true); setError(''); setMessage('');
    const added: Slide[] = [];
    try {
      for (const file of [...files].slice(0, room)) added.push({imagePath: (await uploadImage(file)).path, caption: '', link: ''});
      if (files.length > room) setError(`Only the first ${room} image${room === 1 ? ' was' : 's were'} added (limit ${MAX_SLIDES}).`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Image could not be uploaded.'); }
    finally {
      if (added.length) change({...state, slides: [...state.slides, ...added]});
      setBusy(false); if (input.current) input.current.value = '';
    }
  }

  async function save() {
    if (!state) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/settings/announcements', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(state)});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setState({slides: body.slides, intervalSeconds: body.intervalSeconds}); setDirty(false);
      setMessage(state.slides.length ? 'Saved. The store shows these announcements within a minute.' : 'Saved. The store shows the default picture again.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Announcements could not be saved.'); }
    finally { setBusy(false); }
  }

  return <div className="admin-announcements-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / ANNOUNCEMENTS</p><h1>Announcements</h1><p className="admin-lede">Images shown in the large panel at the top of the store. With more than one image, customers can swipe or use the arrows, and the images also change automatically.</p></div><button type="button" disabled={busy || !dirty || !state} onClick={() => void save()}>{busy ? 'Working…' : 'Save announcements'}</button></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}
    {!state && !error && <p className="muted" role="status">Loading…</p>}
    {state && <>
      <section className="card admin-panel"><h2>Images ({state.slides.length}/{MAX_SLIDES})</h2>
        <p className="field-caption">Best at 4:3 (for example 1200 × 900 px). The whole image is shown, so text near the edges stays readable. PNG, JPEG or WebP up to 12 MB; large files are resized automatically.</p>
        <label className="admin-image-dropzone">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy || state.slides.length >= MAX_SLIDES} onChange={event => void addFiles(event.target.files)}/>
          <span>{busy ? 'Uploading…' : 'Choose images'}</span><small>You can select several at once</small>
        </label>
        {state.slides.length === 0 ? <p className="admin-empty">No announcements. The store shows its default picture.</p> : <ol className="slide-list">{state.slides.map((slide, index) => <li key={slide.imagePath + index} className="slide-row">
          <img src={slide.imagePath} alt=""/>
          <div className="slide-fields">
            <label>Caption (optional, also read by screen readers)<input value={slide.caption} maxLength={160} onChange={event => updateSlide(index, {caption: event.target.value})} placeholder="e.g. New packages this week"/></label>
            <label>Link when tapped (optional)<input value={slide.link} maxLength={300} onChange={event => updateSlide(index, {link: event.target.value})} placeholder="/en#catalog or https://…"/></label>
          </div>
          <div className="slide-actions"><button type="button" className="secondary" aria-label={`Move image ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" className="secondary" aria-label={`Move image ${index + 1} down`} disabled={index === state.slides.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" className="admin-remove-link" onClick={() => change({...state, slides: state.slides.filter((_, i) => i !== index)})}>Remove</button></div>
        </li>)}</ol>}
        <label className="interval-field">Change image every<select value={state.intervalSeconds} onChange={event => change({...state, intervalSeconds: Number(event.target.value)})}>{[3, 4, 5, 6, 8, 10, 15, 20, 30].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label>
      </section>
      {state.slides.length > 0 && <section className="card admin-panel"><h2>Preview</h2><div className="announcement-preview"><AnnouncementCarousel slides={state.slides} intervalSeconds={state.intervalSeconds}/></div>{dirty && <p className="field-caption">Not published yet: click “Save announcements”.</p>}</section>}
    </>}
  </div>;
}
