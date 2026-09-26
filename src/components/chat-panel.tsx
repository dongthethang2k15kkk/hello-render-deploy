'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useLocale} from 'next-intl';
import type {ChatMessage} from '@/lib/demo-chat';
import type {DemoRole} from '@/lib/demo-accounts';

type Room = {id: string; name: string; lastMessage?: {body: string; createdAt: string} | null};

export default function ChatPanel({role, compact = false}: {role: DemoRole; compact?: boolean}) {
  const vi = useLocale() === 'vi';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState('');
  const [showRoomList, setShowRoomList] = useState(true);
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const messageArea = useRef<HTMLDivElement>(null);
  const roomRef = useRef('');
  const imageInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (signal?: AbortSignal, requestedRoom?: string) => {
    try {
      const query = role === 'admin' && requestedRoom ? `?room=${encodeURIComponent(requestedRoom)}` : '';
      const response = await fetch(`/api/chat${query}`, {cache: 'no-store', signal});
      if (!response.ok) throw new Error(vi ? 'Không thể tải hội thoại.' : 'Could not load conversations.');
      const data = await response.json();
      if (signal?.aborted || (role === 'admin' && (requestedRoom ?? '') !== roomRef.current)) return;
      setRooms(data.rooms);
      setMessages(data.messages);
      setRoom(current => current && data.rooms.some((item: Room) => item.id === current) ? current : data.room);
      setError('');
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : (vi ? 'Mất kết nối.' : 'Connection lost.'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [vi, role]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(controller.signal, roomRef.current), 5000);
    return () => {controller.abort(); window.clearInterval(timer);};
  }, [load]);

  useEffect(() => {
    if (role !== 'admin' || !room) return;
    const controller = new AbortController();
    roomRef.current = room;
    void load(controller.signal, room);
    return () => controller.abort();
  }, [load, role, room]);

  const visible = messages.filter(message => role === 'user' || message.room === room);
  const latest = visible.at(-1)?.id;
  useEffect(() => {if (messageArea.current) messageArea.current.scrollTop = messageArea.current.scrollHeight;}, [latest, room]);

  async function send() {
    const text = body.trim();
    if ((!text && !image) || sending || (role === 'admin' && !room)) return;
    setSending(true);
    setError('');
    try {
      const payload = new FormData();
      payload.set('body', text);
      payload.set('room', room);
      if (image) payload.set('image', image);
      const response = image ? await fetch('/api/chat', {method: 'POST', body: payload}) : await fetch('/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({body: text, room})});
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || (vi ? 'Không thể gửi tin nhắn.' : 'Could not send message.'));
      }
      setBody(current => current === body ? '' : current);
      setImage(current => current === image ? null : current);
      if (imageInput.current) imageInput.current.value = '';
      await load(undefined, roomRef.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (vi ? 'Mất kết nối.' : 'Connection lost.'));
    } finally {setSending(false);}
  }

  const selected = rooms.find(item => item.id === room);
  return <section className={`chat-card card ${role === 'admin' ? 'admin-inbox' : ''} ${compact ? 'chat-compact' : ''}`} aria-label={role === 'admin' ? (vi ? 'Hộp thư khách hàng' : 'Customer inbox') : (vi ? 'Tư vấn' : 'Consultation')}>
    {role === 'admin' && <aside className="chat-sidebar">
      <h2>{vi ? 'Hội thoại' : 'Conversations'}</h2>
      {loading && <p className="muted" role="status">{vi ? 'Đang tải…' : 'Loading…'}</p>}
      {!loading && rooms.length === 0 && <p className="muted">{vi ? 'Chưa có khách hàng nhắn tin.' : 'No customer messages yet.'}</p>}
      {rooms.map(item => {
        return <button type="button" className={`chat-room ${room === item.id ? 'active' : ''}`} aria-current={room === item.id ? 'true' : undefined} key={item.id} onClick={() => {roomRef.current = item.id; setRoom(item.id); setShowRoomList(false);}}>
          <span className="chat-avatar" aria-hidden="true">{item.name.charAt(0).toUpperCase()}</span>
          <span className="chat-room-info"><strong>{item.name}</strong><small>{item.lastMessage?.body ?? ''}</small></span>
          <time dateTime={item.lastMessage?.createdAt}>{item.lastMessage ? new Date(item.lastMessage.createdAt).toLocaleTimeString(vi ? 'vi-VN' : 'en-US', {hour: '2-digit', minute: '2-digit'}) : ''}</time>
        </button>;
      })}
    </aside>}
    <div className={`chat-main ${showRoomList ? 'show-room-list' : ''}`}>
      <div className="chat-header"><div>{role === 'admin' && <button type="button" className="inbox-back secondary" onClick={() => setShowRoomList(true)}>← {vi ? 'Danh sách' : 'Conversations'}</button>}<span className="eyebrow">{role === 'admin' ? 'ADMIN INBOX' : 'DIRECT SUPPORT'}</span><h2>{role === 'admin' ? (selected?.name ?? (vi ? 'Chọn hội thoại' : 'Select a conversation')) : (vi ? 'Tư vấn với Admin' : 'Chat with Admin')}</h2></div><span className="live-dot">● {vi ? 'Hỗ trợ trực tuyến' : 'Support available'}</span></div>
      <div className="chat-messages" ref={messageArea} role="log" aria-label={vi ? 'Lịch sử tin nhắn' : 'Message history'}>
        {loading && <p className="muted" role="status">{vi ? 'Đang tải tin nhắn…' : 'Loading messages…'}</p>}
        {!loading && !visible.length && <div className="chat-empty"><span aria-hidden="true">✦</span><p>{role === 'admin' ? (vi ? 'Chọn một khách hàng để bắt đầu.' : 'Select a customer to get started.') : (vi ? 'Chào bạn! Hãy gửi câu hỏi, Admin sẽ phản hồi tại đây.' : 'Hello! Send a question and our team will reply here.')}</p></div>}
        {visible.map(message => <article className={`chat-message ${message.role === role ? 'mine' : ''}`} key={message.id}><small>{message.author} · {new Date(message.createdAt).toLocaleTimeString(vi ? 'vi-VN' : 'en-US', {hour: '2-digit', minute: '2-digit'})}</small>{message.body && <p>{message.body}</p>}{message.image && <img className="chat-image" src={message.image.url} alt={message.image.name}/>}</article>)}
        <div ref={bottom}/>
      </div>
      <form className="chat-compose" onSubmit={event => {event.preventDefault(); void send();}}><div className="chat-compose-fields"><textarea aria-label={vi ? 'Tin nhắn' : 'Message'} value={body} onChange={event => setBody(event.target.value)} placeholder={vi ? 'Viết tin nhắn…' : 'Write a message…'} maxLength={1000} onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); void send();}}}/><label className="chat-image-picker">{vi ? '📷 Chọn ảnh (tối đa 1 MB)' : '📷 Choose image (max 1 MB)'}<input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={sending || (role === 'admin' && !room)} onChange={event => {const file = event.target.files?.[0] ?? null; if (file && (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {setError(vi ? 'Chỉ nhận ảnh PNG, JPEG, WebP tối đa 1 MB.' : 'Only PNG, JPEG, WebP images up to 1 MB.'); event.target.value = ''; setImage(null);} else {setImage(file); setError('');}}}/></label>{image && <div className="chat-image-selected"><span>{image.name}</span><button type="button" className="secondary" onClick={() => {setImage(null); if (imageInput.current) imageInput.current.value = '';}}>{vi ? 'Bỏ ảnh' : 'Remove image'}</button></div>}</div><button type="submit" disabled={(!body.trim() && !image) || sending || (role === 'admin' && !room)}>{sending ? (vi ? 'Đang gửi…' : 'Sending…') : (vi ? 'Gửi' : 'Send')}</button></form>
      {error && <p className="error-text" role="alert">{error} <button className="secondary" type="button" onClick={() => void load(undefined, roomRef.current)}>{vi ? 'Thử lại' : 'Retry'}</button></p>}
      {!compact && <p className="field-caption chat-caption">{vi ? 'Demo: cập nhật mỗi 5 giây; tin nhắn mất khi server khởi động lại.' : 'Demo: refreshes every 5 seconds; messages reset on server restart.'}</p>}
    </div>
  </section>;
}