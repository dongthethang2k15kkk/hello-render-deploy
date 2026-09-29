'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_IMAGE_SOURCE_BYTES, productImageId, productImageTypes} from '@/lib/product-image';

type DeliveryField = {key: string; labelEn: string; required: boolean; maxLength: number};
type ProductPackage = {sku: string; baseUsdCents: number; saleUsdCents: number | null; stockOnHand: number; active: boolean; translations: Record<string, {title: string; description: string}>; fields: DeliveryField[]};
type Product = {id: string; slug: string; active: boolean; category: string; sortOrder: number; imagePath: string; translations: Record<string, {title: string; description: string}>; packages: ProductPackage[]};

const emptyField = (): DeliveryField => ({key: '', labelEn: '', required: false, maxLength: 80});
const emptyPackage = (): ProductPackage => ({sku: '', baseUsdCents: 100, saleUsdCents: null, stockOnHand: 0, active: false, translations: {en: {title: '', description: ''}}, fields: [{key: 'recipient', labelEn: 'Recipient', required: true, maxLength: 80}]});
const emptyProduct = (): Product => ({id: '', slug: '', active: false, category: 'general', sortOrder: 0, imagePath: '', translations: {en: {title: '', description: ''}}, packages: [emptyPackage()]});
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
const englishFields = (fields: DeliveryField[] = []) => fields.map(({key, labelEn, required, maxLength}) => ({key, labelEn, required, maxLength}));
const imageMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;

async function prepareProductImage(file: File) {
  if (!productImageTypes.has(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (file.size === 0 || file.size > MAX_PRODUCT_IMAGE_SOURCE_BYTES) throw new Error('Choose an image up to 12 MB. Large images are optimized before upload.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This image could not be read. Try exporting it as PNG, JPEG or WebP.'); }
  try {
    const maxDimension = 1800;
    if (file.size <= MAX_PRODUCT_IMAGE_BYTES && bitmap.width <= maxDimension && bitmap.height <= maxDimension) return file;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image optimization is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob || blob.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error('The optimized image is still over 2 MB. Choose a smaller image.');
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'product';
    return new File([blob], `${baseName}.webp`, {type: 'image/webp'});
  } finally { bitmap.close(); }
}

export default function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [current, setCurrent] = useState<Product>(emptyProduct());
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [databaseReady, setDatabaseReady] = useState<boolean | null>(null);
  const [dirty, setDirty] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);
  const [imageMessage, setImageMessage] = useState('');
  const [pendingImagePath, setPendingImagePath] = useState('');
  const [persistedImagePath, setPersistedImagePath] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);

  async function load() {
    setBusy(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/admin/products', {cache: 'no-store', signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProducts(data.products); setDatabaseReady(true); setError('');
    } catch (cause) {
      setDatabaseReady(false); setError(cause instanceof DOMException && cause.name === 'AbortError' ? 'The database check timed out.' : cause instanceof Error ? cause.message : 'Products could not be loaded.');
    } finally {window.clearTimeout(timer); setBusy(false);}
  }

  useEffect(() => {void load();}, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {if (dirty) event.preventDefault();};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(path: string, value: unknown) {
    setCurrent(previous => {
      const next = structuredClone(previous) as Product;
      const parts = path.split('.');
      let target = next as unknown as Record<string, unknown>;
      parts.slice(0, -1).forEach(part => {target = target[part] as Record<string, unknown>;});
      target[parts.at(-1)!] = value;
      return next;
    });
    setDirty(true); setMessage('');
  }

  function selectProduct(product: Product) {
    if (uploadingImage) return;
    if (dirty && !window.confirm('Discard unsaved changes and open another product?')) return;
    if (pendingImagePath) void deleteUploadedImage(pendingImagePath);
    setCurrent(structuredClone(product)); setPersistedImagePath(product.imagePath); setPendingImagePath(''); setImageMessage(''); setDirty(false); setError(''); setMessage(''); window.scrollTo({top: 0, behavior: 'smooth'});
  }

  function startNew() {
    if (uploadingImage) return;
    if (dirty && !window.confirm('Discard unsaved changes and create a new product?')) return;
    if (pendingImagePath) void deleteUploadedImage(pendingImagePath);
    setCurrent(emptyProduct()); setPersistedImagePath(''); setPendingImagePath(''); setImageMessage(''); setDirty(false); setError(''); setMessage('');
  }

  async function deleteUploadedImage(path: string) {
    const id = productImageId(path);
    if (!id) return;
    try { await fetch(`/api/admin/product-images?id=${encodeURIComponent(id)}`, {method: 'DELETE'}); }
    catch { /* Best effort; referenced images are protected server-side. */ }
  }

  async function uploadProductImage(file: File) {
    setUploadingImage(true); setError(''); setImageMessage('Optimizing image…');
    try {
      const prepared = await prepareProductImage(file);
      setImageMessage(`Uploading ${imageMegabytes(prepared.size)}…`);
      const form = new FormData(); form.set('file', prepared);
      const response = await fetch('/api/admin/product-images', {method: 'POST', body: form});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Image could not be uploaded.');
      if (pendingImagePath && pendingImagePath !== data.path) void deleteUploadedImage(pendingImagePath);
      update('imagePath', data.path); setPendingImagePath(data.path);
      setImageMessage(`${data.reused ? 'Existing image reused' : 'Image uploaded'} (${imageMegabytes(data.sizeBytes)}). Save the product to publish it.`);
    } catch (cause) { setImageMessage(''); setError(cause instanceof Error ? cause.message : 'Image could not be uploaded.'); }
    finally { setUploadingImage(false); setDraggingImage(false); if (imageInput.current) imageInput.current.value = ''; }
  }

  function removeCurrentImage() {
    if (pendingImagePath && current.imagePath === pendingImagePath) {void deleteUploadedImage(pendingImagePath); setPendingImagePath('');}
    update('imagePath', ''); setImageMessage('Image removed from this draft. Save the product to confirm.');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (uploadingImage) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = {id: current.id || undefined, slug: current.slug, category: current.category, sortOrder: current.sortOrder, imagePath: current.imagePath, active: current.active, en: current.translations.en, packages: current.packages.map(item => ({sku: item.sku, baseUsdCents: item.baseUsdCents, saleUsdCents: item.saleUsdCents, stockOnHand: item.stockOnHand, active: item.active, en: item.translations.en, fields: englishFields(item.fields)}))};
      const response = await fetch('/api/admin/products', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const previousImagePath = persistedImagePath;
      setCurrent(data.product); setPersistedImagePath(data.product.imagePath); setPendingImagePath(''); setImageMessage(''); setDirty(false); setMessage('Product saved. Storefront visibility follows the product and package switches.');
      if (previousImagePath && previousImagePath !== data.product.imagePath) void deleteUploadedImage(previousImagePath);
      await load();
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Product could not be saved.');}
    finally {setBusy(false);}
  }

  async function remove(product: Product) {
    if (uploadingImage || busy) return;
    const name = product.translations.en?.title || product.slug;
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/products?id=${product.id}`, {method: 'DELETE'});
    if (response.ok) {if (current.id === product.id) {setCurrent(emptyProduct()); setPersistedImagePath(''); setPendingImagePath(''); setImageMessage(''); setDirty(false);} if (product.imagePath) void deleteUploadedImage(product.imagePath); await load();}
    else {const data = await response.json(); setError(data.error);}
  }

  const shown = useMemo(() => products.filter(product => `${product.slug} ${product.translations.en?.title}`.toLowerCase().includes(query.trim().toLowerCase())), [products, query]);
  const title = current.translations.en?.title ?? '';

  return <div className="admin-products-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow">ADMIN / SETTINGS / PRODUCTS</p><h1>Products</h1><p className="admin-lede">Create products, set prices and stock, and define the information required for delivery.</p></div><button type="button" onClick={startNew} disabled={databaseReady !== true || uploadingImage || busy}>+ New product</button></div>

    {databaseReady === null && <div className="admin-system-banner" role="status">Checking product database…</div>}
    {databaseReady === false && <div className="admin-system-banner error" role="alert"><strong>Product management is unavailable.</strong><span>{error} Configure PostgreSQL before entering product information.</span><button className="secondary" type="button" onClick={() => void load()}>Try again</button></div>}

    {databaseReady === true && <div className="admin-products-layout">
      <aside className="admin-product-list card" aria-label="Product list">
        <div className="admin-list-heading"><div><h2>Catalog</h2><p>{products.length} product{products.length === 1 ? '' : 's'}</p></div><button type="button" className="secondary" onClick={startNew} disabled={uploadingImage || busy}>New</button></div>
        <label className="admin-search"><span>Search</span><input type="search" placeholder="Name or slug" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <div className="admin-product-items">{shown.length === 0 && <p className="admin-empty">No matching products.</p>}{shown.map(product => <article className={`admin-product-row ${current.id === product.id ? 'selected' : ''}`} key={product.id}><button type="button" className="admin-product-open" disabled={uploadingImage} onClick={() => selectProduct(product)}><strong>{product.translations.en?.title || 'Untitled product'}</strong><span>{product.slug}</span><small>{product.active ? 'Visible in store' : 'Hidden from store'} · {product.packages.length} package{product.packages.length === 1 ? '' : 's'}</small></button><button type="button" className="admin-delete" disabled={uploadingImage || busy} aria-label={`Delete ${product.translations.en?.title || product.slug}`} onClick={() => void remove(product)}>Delete</button></article>)}</div>
      </aside>

      <form className="admin-product-form" onSubmit={save}>
        <div className="admin-form-toolbar"><div><p className="eyebrow">{current.id ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</p><h2>{title || 'Untitled product'}</h2><p>{dirty ? 'Unsaved changes' : current.id ? 'All changes saved' : 'Complete the required fields to add this product'}</p></div><button disabled={busy || uploadingImage || !dirty} type="submit">{busy ? 'Saving…' : 'Save product'}</button></div>
        {error && <p className="admin-feedback error" role="alert">{error}</p>}{message && <p className="admin-feedback success" role="status">{message}</p>}

        <section className="admin-form-section card">
          <div className="admin-section-heading"><span>1</span><div><h3>Product information</h3><p>What customers see in the catalog.</p></div></div>
          <div className="admin-field-grid">
            <label className="wide">Product name<input required value={title} onChange={event => {const value = event.target.value; const oldSlug = slugify(title); update('translations.en.title', value); if (!current.id && (!current.slug || current.slug === oldSlug)) update('slug', slugify(value));}}/></label>
            <label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={current.slug} onChange={event => update('slug', event.target.value)}/><small>Used in the product URL.</small></label>
            <label>Category<input required value={current.category} onChange={event => update('category', event.target.value)}/></label>
            <label className="wide">Description<textarea rows={5} value={current.translations.en?.description ?? ''} onChange={event => update('translations.en.description', event.target.value)}/></label>
            <div className="admin-image-manager wide">
              <div className="admin-image-preview">{current.imagePath ? <img src={current.imagePath} alt={`Preview of ${title || 'product image'}`}/> : <div><strong>No image yet</strong><span>Add a clear preview customers can recognize quickly.</span></div>}</div>
              <div className="admin-image-controls">
                <div><strong>Product image</strong><p>Upload here. Large files are automatically resized and converted to WebP.</p></div>
                <label className={`admin-image-dropzone ${draggingImage ? 'dragging' : ''} ${uploadingImage ? 'busy' : ''}`} onDragEnter={event => {event.preventDefault(); setDraggingImage(true);}} onDragOver={event => {event.preventDefault(); setDraggingImage(true);}} onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingImage(false);}} onDrop={event => {event.preventDefault(); setDraggingImage(false); const file = event.dataTransfer.files[0]; if (file) void uploadProductImage(file);}}>
                  <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingImage || busy} onChange={event => {const file = event.target.files?.[0]; if (file) void uploadProductImage(file);}}/>
                  <span>{uploadingImage ? 'Uploading…' : current.imagePath ? 'Replace image' : 'Choose image'}</span>
                  <small>or drag and drop PNG, JPEG or WebP — source up to 12 MB</small>
                </label>
                <div className="admin-image-links">{current.imagePath && <><a href={current.imagePath} target="_blank" rel="noreferrer">Open full image</a><button className="admin-remove-link" type="button" disabled={uploadingImage || busy} onClick={removeCurrentImage}>Remove image</button></>}</div>
                {imageMessage && <p className="admin-image-status" role="status">{imageMessage}</p>}
              </div>
            </div>
            <label>Display order<input type="number" min="0" value={current.sortOrder} onChange={event => update('sortOrder', Number(event.target.value))}/></label>
          </div>
          <label className="admin-switch"><input type="checkbox" checked={current.active} onChange={event => update('active', event.target.checked)}/><span><strong>Visible in store</strong><small>Customers can find this product after you save.</small></span></label>
        </section>

        <section className="admin-form-section card">
          <div className="admin-section-heading"><span>2</span><div><h3>Packages, pricing and stock</h3><p>Prices are entered in US dollars and stored safely as cents.</p></div></div>
          <div className="admin-package-list">{current.packages.map((item, packageIndex) => <article className="admin-package" key={packageIndex}>
            <div className="admin-package-heading"><h4>Package {packageIndex + 1}{item.translations.en?.title ? ` · ${item.translations.en.title}` : ''}</h4>{current.packages.length > 1 && <button className="admin-remove-link" type="button" onClick={() => {setCurrent(previous => ({...previous, packages: previous.packages.filter((_, index) => index !== packageIndex)})); setDirty(true);}}>Remove package</button>}</div>
            <div className="admin-field-grid">
              <label>Package name<input required value={item.translations.en?.title ?? ''} onChange={event => update(`packages.${packageIndex}.translations.en.title`, event.target.value)}/></label>
              <label>SKU<input required pattern="[a-zA-Z0-9_-]+" value={item.sku} onChange={event => update(`packages.${packageIndex}.sku`, event.target.value)}/></label>
              <label className="wide">Package description<textarea rows={3} value={item.translations.en?.description ?? ''} onChange={event => update(`packages.${packageIndex}.translations.en.description`, event.target.value)}/></label>
              <label>Base price (USD)<span className="money-input"><span>$</span><input type="number" step="0.01" min="0.01" value={item.baseUsdCents / 100} onChange={event => update(`packages.${packageIndex}.baseUsdCents`, Math.round(Number(event.target.value) * 100))}/></span></label>
              <label>Sale price (USD)<span className="money-input"><span>$</span><input type="number" step="0.01" min="0.01" placeholder="No sale" value={item.saleUsdCents === null ? '' : item.saleUsdCents / 100} onChange={event => update(`packages.${packageIndex}.saleUsdCents`, event.target.value ? Math.round(Number(event.target.value) * 100) : null)}/></span></label>
              <label>Stock available<input type="number" min="0" value={item.stockOnHand} onChange={event => update(`packages.${packageIndex}.stockOnHand`, Number(event.target.value))}/></label>
            </div>
            <label className="admin-switch"><input type="checkbox" checked={item.active} onChange={event => update(`packages.${packageIndex}.active`, event.target.checked)}/><span><strong>Package available</strong><small>Customers can select this package when the product is visible.</small></span></label>
            <div className="admin-delivery-fields"><div className="admin-subheading"><div><h5>Delivery information</h5><p>Fields customers must complete for this package.</p></div><button className="secondary" type="button" onClick={() => {setCurrent(previous => {const next = structuredClone(previous); next.packages[packageIndex].fields.push(emptyField()); return next;}); setDirty(true);}}>+ Add field</button></div>
              {item.fields.length === 0 && <p className="admin-empty">No delivery information is required.</p>}
              {item.fields.map((field, fieldIndex) => <div className="admin-delivery-row" key={fieldIndex}><label>Field label<input required value={field.labelEn} onChange={event => update(`packages.${packageIndex}.fields.${fieldIndex}.labelEn`, event.target.value)}/></label><label>Field key<input required pattern="[a-z][a-z0-9_]*" value={field.key} onChange={event => update(`packages.${packageIndex}.fields.${fieldIndex}.key`, event.target.value)}/></label><label>Max length<input type="number" min="1" max="1000" value={field.maxLength} onChange={event => update(`packages.${packageIndex}.fields.${fieldIndex}.maxLength`, Number(event.target.value))}/></label><label className="admin-compact-check"><input type="checkbox" checked={field.required} onChange={event => update(`packages.${packageIndex}.fields.${fieldIndex}.required`, event.target.checked)}/> Required</label><button className="admin-remove-link" type="button" onClick={() => {setCurrent(previous => {const next = structuredClone(previous); next.packages[packageIndex].fields.splice(fieldIndex, 1); return next;}); setDirty(true);}}>Remove</button></div>)}
            </div>
          </article>)}</div>
          <button className="secondary" type="button" onClick={() => {setCurrent(previous => ({...previous, packages: [...previous.packages, emptyPackage()]})); setDirty(true);}}>+ Add another package</button>
        </section>
        <div className="admin-form-footer"><span>{uploadingImage ? 'Uploading product image…' : dirty ? 'You have unsaved changes.' : 'No unsaved changes.'}</span><button disabled={busy || uploadingImage || !dirty} type="submit">{busy ? 'Saving…' : 'Save product'}</button></div>
      </form>
    </div>}
  </div>;
}
