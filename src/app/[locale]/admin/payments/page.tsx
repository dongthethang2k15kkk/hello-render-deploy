'use client';
import {useState} from 'react';
import {useCart} from '@/components/cart-provider';
import {paymentAmount} from '@/lib/payment-rules';

type Receiver = {id?: string; label: string; method: 'bank' | 'ltc'; destination: string; bank: string; holder: string; qrPath: string; active: boolean; pendingLimit: number};
type Order = {id: string; method: string; status: string; reference: string; amountMinor: string; expiresAt: string; receiverSnapshot: Receiver; events: {id: string; actor: string; action: string; createdAt: string}[]};
const blank: Receiver = {label: '', method: 'bank', destination: '', bank: '', holder: '', qrPath: '', active: false, pendingLimit: 10};

export default function PaymentAdmin() {
  const {lines} = useCart();
  const [key, setKey] = useState('');
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [receiver, setReceiver] = useState<Receiver>(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState('bank');
  const [requestKey, setRequestKey] = useState('');
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [role, setRole] = useState<'admin' | ''>('');
  async function api(command?: unknown) {
    const response = await fetch('/api/payment-admin', {method: command ? 'POST' : 'GET', headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json'}, ...(command ? {body: JSON.stringify(command)} : {})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  async function run(command?: unknown) {
    setBusy(true); setError('');
    try {
      if (command) await api(command);
      const data = await api(); setReceivers(data.receivers); setOrders(data.orders); setRole(data.role);
    } catch (e) {setError(e instanceof Error ? e.message : 'Request failed');}
    finally {setBusy(false);}
  }
  async function upload(file: File) {
    setUploading(true); setError('');
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch('/api/payment-admin/upload', {method: 'POST', headers: {'Authorization': `Bearer ${key}`}, body: form});
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setReceiver(current => ({...current, qrPath: data.path}));
    } catch (e) {setError(e instanceof Error ? e.message : 'Upload failed');}
    finally {setUploading(false);}
  }
  return <><div className="page-heading"><p className="eyebrow">PAYMENT OPERATIONS / STAGING</p><h1>{'Receiving accounts'}</h1><p className="notice">{'Internal staging only. Customer payments are not enabled. Do not send real funds or enter wallet secrets.'}</p></div>
    <section className="card"><label>{'Staging admin key'}<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}/></label><button disabled={busy || !key} onClick={() => run()}>{'Connect / Refresh'}</button> <button onClick={() => {setKey(''); setReceivers([]); setOrders([]); setEvidence({}); setReceiver(blank); setRole(''); setError('');}}>{'Disconnect'}</button>{role && <p className="notice">{'Role: Admin — staging payment management.'}</p>}<p role="alert">{error}</p></section>
    <section className="card" style={{marginTop:20}}><h2>{'Receivers (admin only)'}</h2><form onSubmit={e => {e.preventDefault(); const {id, ...data} = receiver; void run({action: 'receiver', id, receiver: data});}}>
      <label>{'Method'}<select value={receiver.method} onChange={e => setReceiver({...receiver, method: e.target.value as 'bank' | 'ltc'})}><option value="bank">Bank / VND</option><option value="ltc">Litecoin mainnet</option></select></label>
      {(['label', 'destination', 'bank', 'holder'] as const).map(field => <label key={field}>{({label: 'Label', destination: 'Account number or LTC address', bank: 'Bank', holder: 'Account holder'})[field]}<input value={receiver[field]} maxLength={120} onChange={e => setReceiver({...receiver, [field]: e.target.value})}/></label>)}
      <label>{'Choose QR image (PNG, JPEG, WebP; 5 MB max)'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || !key || role !== 'admin'} onChange={e => {const file = e.target.files?.[0]; if (file) void upload(file); e.currentTarget.value = '';}}/></label>
      {uploading && <p role="status">{'Uploading image...'}</p>}
      {receiver.qrPath && <div className="muted"><p>{'Uploaded image (receiver not saved yet)'}</p><img src={receiver.qrPath} width={180} height={180} alt={'QR preview'}/><p><button type="button" disabled={busy || uploading} onClick={() => setReceiver(current => ({...current, qrPath: ''}))}>{'Remove QR image'}</button></p></div>}
      <label>{'Pending order limit'}<input type="number" min="1" max="1000" value={receiver.pendingLimit} onChange={e => setReceiver({...receiver, pendingLimit: Number(e.target.value)})}/></label>
      <label><input type="checkbox" checked={receiver.active} onChange={e => setReceiver({...receiver, active: e.target.checked})}/> {'Accept new orders'}</label>
      <button disabled={busy || uploading || !key || role !== 'admin'}>{'Save receiver'}</button> <button type="button" disabled={role !== 'admin'} onClick={() => setReceiver(blank)}>{'New receiver'}</button>
    </form><p className="muted">{'Static QR does not dynamically include the amount or reference. Verify its destination, network and any embedded amount using your wallet.'}</p>
      {receivers.map(r => <p key={r.id}><button onClick={() => setReceiver({id:r.id, label:r.label, method:r.method, destination:r.destination, bank:r.bank, holder:r.holder, qrPath:r.qrPath, active:r.active, pendingLimit:r.pendingLimit})}>{r.label} · {r.method} · {r.active ? 'ON' : 'OFF'}</button></p>)}
    </section>
    <section className="card" style={{marginTop:20}}><h2>{'Create staging invoice from current cart'}</h2><p>{'Requires an unexpired server exchange rate. Reuse the same key for retries; generate a new key for a new invoice.'}</p><select aria-label="Invoice method" value={method} onChange={e => setMethod(e.target.value)}><option value="bank">Bank / VND</option><option value="ltc">Litecoin</option></select><label>Idempotency key<input value={requestKey} readOnly/></label><button onClick={() => setRequestKey(crypto.randomUUID())}>{'New invoice key'}</button> <button disabled={busy || !key || !requestKey || !lines.length} onClick={() => run({action: 'create', requestKey, method, lines})}>{'Create staging invoice'}</button></section>
    <h2>{'Latest 100 orders'}</h2>
    {orders.map(order => <section className="card" key={order.id} style={{marginBottom:20, overflowWrap:'anywhere'}}><h3>{order.reference}</h3><p><strong>{order.status} · {paymentAmount(order.amountMinor, order.method)}</strong></p><p>{order.receiverSnapshot.bank} {order.receiverSnapshot.holder}</p><p>{order.method === 'ltc' ? 'Litecoin mainnet: ' : ''}{order.receiverSnapshot.destination}</p><p>{'Quote expiry'}: {order.expiresAt}</p>
      {order.receiverSnapshot.qrPath && <img src={order.receiverSnapshot.qrPath} width={200} height={200} alt="Static receiving QR"/>}
      <p className="notice">{'Verify actual receipt, network, amount and confirmations. Review late or short payments manually. Delivery records a manual action; it does not automatically send products.'}</p>
      <label>{'Report: note; confirm: transaction reference/TXID; deliver: fulfillment note'}<input maxLength={500} value={evidence[order.id] ?? ''} onChange={e => setEvidence({...evidence, [order.id]:e.target.value})}/></label>
      {([['PENDING','report','Report transfer (test)'], ['REVIEW','confirm','Confirm funds received'], ['PAID','deliver','Record fulfillment']] as const).filter(([s]) => s === order.status).map(([,action,label]) => <button key={action} disabled={busy || !evidence[order.id]?.trim()} onClick={() => {if (window.confirm(label + '?')) void run({action, id:order.id, evidence:evidence[order.id]});}}>{label}</button>)}
      <details><summary>Audit log</summary>{order.events.map(event => <p key={event.id}>{event.createdAt} · {event.actor} · {event.action}</p>)}</details>
    </section>)}
  </>;
}