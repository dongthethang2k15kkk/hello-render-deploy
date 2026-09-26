'use client';
import {useState} from 'react';
import {useLocale} from 'next-intl';
import {useCart} from '@/components/cart-provider';
import {paymentAmount} from '@/lib/payment-rules';

type Receiver = {id?: string; label: string; method: 'bank' | 'ltc'; destination: string; bank: string; holder: string; qrPath: string; active: boolean; pendingLimit: number};
type Order = {id: string; method: string; status: string; reference: string; amountMinor: string; expiresAt: string; receiverSnapshot: Receiver; events: {id: string; actor: string; action: string; createdAt: string}[]};
const blank: Receiver = {label: '', method: 'bank', destination: '', bank: '', holder: '', qrPath: '', active: false, pendingLimit: 10};

export default function PaymentAdmin() {
  const vi = useLocale() === 'vi';
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
  return <><div className="page-heading"><p className="eyebrow">PAYMENT OPERATIONS / STAGING</p><h1>{vi ? 'Quản lý tài khoản nhận' : 'Receiving accounts'}</h1><p className="notice">{vi ? 'Nội bộ thử nghiệm. Chưa mở thanh toán cho khách. Không chuyển tiền thật. Khóa chỉ giữ trong bộ nhớ trang; không nhập seed phrase/private key.' : 'Internal staging only. Customer payments are not enabled. Do not send real funds or enter wallet secrets.'}</p></div>
    <section className="card"><label>{vi ? 'Khóa Admin staging' : 'Staging admin key'}<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}/></label><button disabled={busy || !key} onClick={() => run()}>{vi ? 'Kết nối / Làm mới' : 'Connect / Refresh'}</button> <button onClick={() => {setKey(''); setReceivers([]); setOrders([]); setEvidence({}); setReceiver(blank); setRole(''); setError('');}}>{vi ? 'Thoát' : 'Disconnect'}</button>{role && <p className="notice">{vi ? 'Vai trò: Admin — quản lý thanh toán staging.' : 'Role: Admin — staging payment management.'}</p>}<p role="alert">{error}</p></section>
    <section className="card" style={{marginTop:20}}><h2>{vi ? 'Tài khoản nhận (chỉ Admin)' : 'Receivers (admin only)'}</h2><form onSubmit={e => {e.preventDefault(); const {id, ...data} = receiver; void run({action: 'receiver', id, receiver: data});}}>
      <label>{vi ? 'Phương thức' : 'Method'}<select value={receiver.method} onChange={e => setReceiver({...receiver, method: e.target.value as 'bank' | 'ltc'})}><option value="bank">Bank / VND</option><option value="ltc">Litecoin mainnet</option></select></label>
      {(['label', 'destination', 'bank', 'holder', 'qrPath'] as const).map(field => <label key={field}>{({label: 'Tên / Label', destination: 'Số tài khoản hoặc địa chỉ LTC / Destination', bank: 'Ngân hàng / Bank', holder: 'Chủ tài khoản / Holder', qrPath: 'Ảnh QR tĩnh /payment-qr/name.png (optional)'})[field]}<input value={receiver[field]} maxLength={120} onChange={e => setReceiver({...receiver, [field]: e.target.value})}/></label>)}
      <label>{vi ? 'Tải ảnh QR (chỉ Admin, tối đa 5 MB)' : 'Upload QR image (admin only, 5 MB max)'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || !key || role !== 'admin'} onChange={e => {const file = e.target.files?.[0]; if (file) void upload(file); e.currentTarget.value = '';}}/></label>
      {receiver.qrPath && <p className="muted">{vi ? 'Ảnh đã chọn' : 'Selected image'}: {receiver.qrPath}<br/><img src={receiver.qrPath} width={180} height={180} alt={vi ? 'Xem trước QR' : 'QR preview'}/></p>}
      <label>{vi ? 'Ngưỡng đơn chờ' : 'Pending order limit'}<input type="number" min="1" max="1000" value={receiver.pendingLimit} onChange={e => setReceiver({...receiver, pendingLimit: Number(e.target.value)})}/></label>
      <label><input type="checkbox" checked={receiver.active} onChange={e => setReceiver({...receiver, active: e.target.checked})}/> {vi ? 'Nhận đơn mới' : 'Accept new orders'}</label>
      <button disabled={busy || !key || role !== 'admin'}>{vi ? 'Lưu tài khoản' : 'Save receiver'}</button> <button type="button" disabled={role !== 'admin'} onClick={() => setReceiver(blank)}>{vi ? 'Thêm mới' : 'New receiver'}</button>
    </form><p className="muted">{vi ? 'Ảnh tĩnh không tự chứa giá hoặc mã đơn. Admin phải kiểm tra QR khớp địa chỉ, mạng và không có số tiền cố định sai. Địa chỉ LTC cần xác minh trong ví.' : 'Static QR does not dynamically include the amount or reference. Verify its destination, network and any embedded amount using your wallet.'}</p>
      {receivers.map(r => <p key={r.id}><button onClick={() => setReceiver({id:r.id, label:r.label, method:r.method, destination:r.destination, bank:r.bank, holder:r.holder, qrPath:r.qrPath, active:r.active, pendingLimit:r.pendingLimit})}>{r.label} · {r.method} · {r.active ? 'ON' : 'OFF'}</button></p>)}
    </section>
    <section className="card" style={{marginTop:20}}><h2>{vi ? 'Tạo hóa đơn thử từ giỏ hiện tại' : 'Create staging invoice from current cart'}</h2><p>{vi ? 'Cần cấu hình tỷ giá server còn hạn. Giữ cùng khóa để thử lại an toàn; đổi khóa khi muốn tạo đơn khác.' : 'Requires an unexpired server exchange rate. Reuse the same key for retries; generate a new key for a new invoice.'}</p><select aria-label="Invoice method" value={method} onChange={e => setMethod(e.target.value)}><option value="bank">Bank / VND</option><option value="ltc">Litecoin</option></select><label>Idempotency key<input value={requestKey} readOnly/></label><button onClick={() => setRequestKey(crypto.randomUUID())}>{vi ? 'Tạo khóa đơn mới' : 'New invoice key'}</button> <button disabled={busy || !key || !requestKey || !lines.length} onClick={() => run({action: 'create', requestKey, method, lines})}>{vi ? 'Tạo hóa đơn staging' : 'Create staging invoice'}</button></section>
    <h2>{vi ? '100 đơn gần nhất' : 'Latest 100 orders'}</h2>
    {orders.map(order => <section className="card" key={order.id} style={{marginBottom:20, overflowWrap:'anywhere'}}><h3>{order.reference}</h3><p><strong>{order.status} · {paymentAmount(order.amountMinor, order.method)}</strong></p><p>{order.receiverSnapshot.bank} {order.receiverSnapshot.holder}</p><p>{order.method === 'ltc' ? 'Litecoin mainnet: ' : ''}{order.receiverSnapshot.destination}</p><p>{vi ? 'Hạn báo giá' : 'Quote expiry'}: {order.expiresAt}</p>
      {order.receiverSnapshot.qrPath && <img src={order.receiverSnapshot.qrPath} width={200} height={200} alt="Static receiving QR"/>}
      <p className="notice">{vi ? 'Kiểm tra tiền thực nhận, đúng mạng, đúng số tiền và đủ xác nhận trước khi xác nhận. Đơn quá hạn hoặc chuyển thiếu cần đối soát riêng. Giao hàng chỉ ghi nhận thao tác thủ công, không tự gửi sản phẩm.' : 'Verify actual receipt, network, amount and confirmations. Review late or short payments manually. Delivery records a manual action; it does not automatically send products.'}</p>
      <label>{vi ? 'Báo chuyển: ghi chú; xác nhận: mã giao dịch/TXID; giao hàng: mô tả giao hàng' : 'Report: note; confirm: transaction reference/TXID; deliver: fulfillment note'}<input maxLength={500} value={evidence[order.id] ?? ''} onChange={e => setEvidence({...evidence, [order.id]:e.target.value})}/></label>
      {([['PENDING','report',vi ? 'Báo đã chuyển (thử)' : 'Report transfer (test)'], ['REVIEW','confirm',vi ? 'Xác nhận đã nhận tiền' : 'Confirm funds received'], ['PAID','deliver',vi ? 'Ghi nhận đã giao' : 'Record fulfillment']] as const).filter(([s]) => s === order.status).map(([,action,label]) => <button key={action} disabled={busy || !evidence[order.id]?.trim()} onClick={() => {if (window.confirm(label + '?')) void run({action, id:order.id, evidence:evidence[order.id]});}}>{label}</button>)}
      <details><summary>Audit log</summary>{order.events.map(event => <p key={event.id}>{event.createdAt} · {event.actor} · {event.action}</p>)}</details>
    </section>)}
  </>;
}