'use client';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {BUILTIN_BACKGROUNDS, clampPercent, defaultScene, DESIGN_WIDTH, layerStyle, MAX_LAYERS, newLayer, type BackgroundLayer, type BackgroundScene} from '@/lib/background-rules';
import {uploadImage} from '@/lib/image-upload';
import {LoadingRows} from '@/components/loading-state';

const layerId = () => `layer-${Math.random().toString(36).slice(2, 10)}`;

/** Admin editor for the faint images behind the storefront: drop new pictures, drag them into place, tune each one. */
export default function BackgroundSettings() {
  const locale = useLocale();
  const [scene, setScene] = useState<BackgroundScene | null>(null);
  const [selected, setSelected] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [scale, setScale] = useState(0.5);
  const preview = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dragging = useRef<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings/background', {cache: 'no-store'}).then(async response => {
      if (response.status === 403) { window.location.assign(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setScene({layers: body.layers}); setSelected(body.layers.find((layer: BackgroundLayer) => layer.kind === 'floating')?.id ?? '');
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'The background could not be loaded.'));
  }, [locale]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  // The preview stands for a 1440 px wide window; pixel sizes shrink with it.
  useEffect(() => {
    const element = preview.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScale(element.clientWidth / DESIGN_WIDTH));
    observer.observe(element);
    return () => observer.disconnect();
  }, [scene !== null]);

  function edit(apply: (layers: BackgroundLayer[]) => BackgroundLayer[]) {
    setScene(current => current && {layers: apply(current.layers)}); setDirty(true); setMessage('');
  }
  const update = (id: string, patch: Partial<BackgroundLayer>) => edit(layers => layers.map(layer => layer.id === id ? {...layer, ...patch} : layer));
  const move = (index: number, delta: number) => edit(layers => {
    const next = [...layers]; const target = index + delta;
    if (target < 0 || target >= next.length) return layers;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  function pointAt(clientX: number, clientY: number) {
    const rect = preview.current!.getBoundingClientRect();
    return {x: clampPercent(((clientX - rect.left) / rect.width) * 100), y: clampPercent(((clientY - rect.top) / rect.height) * 100)};
  }

  async function addFiles(files: File[], at?: {x: number; y: number}) {
    if (!files.length || !scene) return;
    const room = MAX_LAYERS - scene.layers.length;
    if (room <= 0) { setError(`Use at most ${MAX_LAYERS} images. Remove one first.`); return; }
    setBusy(true); setError(''); setMessage('');
    const added: BackgroundLayer[] = [];
    try {
      for (const [index, file] of files.slice(0, room).entries()) added.push(newLayer((await uploadImage(file)).path, layerId(), at ? {x: at.x + index * 4, y: at.y + index * 4} : undefined));
      if (files.length > room) setError(`Only the first ${room} image${room === 1 ? ' was' : 's were'} added (limit ${MAX_LAYERS}).`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Image could not be uploaded.'); }
    finally {
      if (added.length) { edit(layers => [...layers, ...added]); setSelected(added.at(-1)!.id); }
      setBusy(false); if (input.current) input.current.value = '';
    }
  }
  function addBuiltin(path: string) {
    if (!scene) return;
    if (scene.layers.length >= MAX_LAYERS) { setError(`Use at most ${MAX_LAYERS} images. Remove one first.`); return; }
    const layer = newLayer(path, layerId());
    edit(layers => [...layers, layer]); setSelected(layer.id);
  }

  async function save() {
    if (!scene) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/settings/background', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(scene)});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDirty(false); setMessage('Background saved. The store shows it within 30 seconds.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The background could not be saved.'); }
    finally { setBusy(false); }
  }

  const back = <Link href={`/${locale}/admin/settings`}>← Settings</Link>;
  if (!scene) return <div className="page-heading">{back}<h1>Background</h1>{error ? <p className="admin-feedback error" role="alert">{error}</p> : <LoadingRows label="Loading the background…"/>}</div>;

  return <div className="page-heading bg-settings">{back}
    <p className="eyebrow">ADMIN / SETTINGS / BACKGROUND</p><h1>Background</h1>
    <p className="muted">The faint pictures behind the store. Drop new images on the preview, drag pictures into place and tune each one. Glass panels on the store blur whatever is behind them.</p>
    <div className="bg-editor">
      <div className="bg-preview-wrap">
        <div ref={preview} className={`bg-preview ${dragOver ? 'drag-over' : ''}`} role="group" aria-label="Background preview (1440 × 900 window)"
          onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={event => { event.preventDefault(); setDragOver(false); void addFiles([...event.dataTransfer.files], pointAt(event.clientX, event.clientY)); }}>
          {scene.layers.map(layer => {
            const style = layerStyle(layer, scale);
            if (layer.kind === 'backdrop') return <div key={layer.id} className="bg-layer bg-backdrop" style={style.outer}><div style={style.inner}/></div>;
            return <div key={layer.id} role="button" tabIndex={0} aria-label={`Picture ${scene.layers.indexOf(layer) + 1}: drag or use the arrow keys to move it`} aria-pressed={selected === layer.id}
              className={`bg-layer bg-floating ${selected === layer.id ? 'selected' : ''}`} style={style.outer}
              onPointerDown={event => { event.preventDefault(); setSelected(layer.id); dragging.current = layer.id; event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => { if (dragging.current === layer.id) update(layer.id, pointAt(event.clientX, event.clientY)); }}
              onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}
              onKeyDown={event => {
                const step = event.shiftKey ? 5 : 1;
                const delta = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]}[event.key];
                if (!delta) return;
                event.preventDefault(); setSelected(layer.id);
                update(layer.id, {x: clampPercent(layer.x + delta[0]), y: clampPercent(layer.y + delta[1])});
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={layer.imagePath} alt="" draggable={false} style={style.inner}/>
            </div>;
          })}
          {/* A sketch of the page on top, to judge how the glass and the pictures work together. */}
          <div className="bg-preview-mock" aria-hidden="true"><div className="mock-header"/><div className="mock-hero"/><div className="mock-cards"><span/><span/></div></div>
          {dragOver && <div className="bg-drop-hint">Drop to add here</div>}
        </div>
        <div className="bg-drop">
          <label className="button secondary">Choose images<input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden disabled={busy} onChange={event => void addFiles([...(event.target.files ?? [])])}/></label>
          <span className="field-caption">or drop them on the preview · PNG, JPEG or WebP · up to {MAX_LAYERS} pictures</span>
        </div>
        <div className="bg-builtins" aria-label="Pictures that come with the site">
          <span className="field-caption">Add a built-in picture:</span>
          {BUILTIN_BACKGROUNDS.map(path => <button key={path} type="button" title={`Add ${path.slice(1)}`} onClick={() => addBuiltin(path)} disabled={busy}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={path} alt={`Add ${path.slice(1)}`}/></button>)}
        </div>
      </div>

      <div className="bg-layers">
        <ol className="bg-layer-list">
          {scene.layers.map((layer, index) => <li key={layer.id} className={`bg-layer-item ${selected === layer.id ? 'selected' : ''}`} onClick={() => setSelected(layer.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bg-thumb" src={layer.imagePath} alt=""/>
            <div className="bg-layer-fields">
              <div className="bg-layer-head"><strong>{index + 1}.</strong>
                <select aria-label={`Picture ${index + 1} type`} value={layer.kind} onChange={event => update(layer.id, {kind: event.target.value as BackgroundLayer['kind']})}>
                  <option value="floating">Floating picture</option><option value="backdrop">Full-screen backdrop</option>
                </select>
              </div>
              {layer.kind === 'floating' && <label className="bg-range">Size<input type="range" min={40} max={900} step={10} value={layer.size} onChange={event => update(layer.id, {size: Number(event.target.value)})}/><output>{layer.size}px</output></label>}
              <label className="bg-range">Opacity<input type="range" min={2} max={100} value={Math.round(layer.opacity * 100)} onChange={event => update(layer.id, {opacity: Number(event.target.value) / 100})}/><output>{Math.round(layer.opacity * 100)}%</output></label>
              {layer.kind === 'floating' && <label className="bg-range">Rotate<input type="range" min={-45} max={45} value={layer.rotate} onChange={event => update(layer.id, {rotate: Number(event.target.value)})}/><output>{layer.rotate}°</output></label>}
              <label className="bg-range">Blur<input type="range" min={0} max={12} step={0.5} value={layer.blur} onChange={event => update(layer.id, {blur: Number(event.target.value)})}/><output>{layer.blur}px</output></label>
              {layer.kind === 'floating' && <div className="bg-checks">
                <label className="admin-compact-check"><input type="checkbox" checked={layer.float} onChange={event => update(layer.id, {float: event.target.checked})}/> Drift gently</label>
                <label className="admin-compact-check"><input type="checkbox" checked={layer.hideOnMobile} onChange={event => update(layer.id, {hideOnMobile: event.target.checked})}/> Hide on phones</label>
              </div>}
              <div className="bg-layer-actions">
                <button type="button" className="secondary" disabled={index === 0} onClick={() => move(index, -1)}>Send back</button>
                <button type="button" className="secondary" disabled={index === scene.layers.length - 1} onClick={() => move(index, 1)}>Bring front</button>
                <button type="button" className="admin-remove-link" onClick={() => edit(layers => layers.filter(item => item.id !== layer.id))}>Remove</button>
              </div>
            </div>
          </li>)}
        </ol>
        {!scene.layers.length && <p className="muted">No pictures: the store shows only its colour glow. Add one on the left.</p>}
        {error && <p className="admin-feedback error" role="alert">{error}</p>}
        {message && <p className="admin-feedback success" role="status">{message}</p>}
        <div className="admin-form-footer bg-footer">
          <span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <button type="button" className="secondary" disabled={busy} onClick={() => { if (window.confirm('Go back to the original background? Unsaved changes are lost.')) { edit(() => defaultScene.layers); setSelected(defaultScene.layers[1].id); } }}>Reset to default</button>
          <button type="button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Saving…' : 'Save background'}</button>
        </div>
      </div>
    </div>
  </div>;
}
