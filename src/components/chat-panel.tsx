'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {ChatMessage} from '@/lib/chat-store';
import type {Role} from '@/lib/admin-session';
import {PresenceBadges, useAdminPresence} from './admin-presence';

type Room = {id: string; name: string; lastMessage?: {body: string; createdAt: string; role: Role} | null};

export default function ChatPanel({role, compact = false, initialRoom = ''}: {role: Role; compact?: boolean; initialRoom?: string}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState(initialRoom);
  const [showRoomList, setShowRoomList] = useState(!initialRoom);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [image, setImage] = useState<File | null>(null);
  const [roomQuery, setRoomQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState<'all' | 'needs-reply'>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const messageArea = useRef<HTMLDivElement>(null);
  const roomRef = useRef(initialRoom);
  const imageInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (signal?: AbortSignal, requestedRoom?: string) => {
    try {
      const query = role === 'admin' && requestedRoom ? `?room=${encodeURIComponent(requestedRoom)}` : '';
      const response = await fetch(`/api/chat${query}`, {cache: 'no-store', signal});
      if (!response.ok) throw new Error('Could not load conversations.');
      const data = await response.json();
      if (signal?.aborted || (role === 'admin' && (requestedRoom ?? '') !== roomRef.current)) return;
      setRooms(data.rooms);
      setMessages(data.messages);
      setRoom(current => current && data.rooms.some((item: Room) => item.id === current) ? current : data.room);
      setError('');
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Connection lost.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal, roomRef.current || undefined);
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
  const draftKey = role === 'admin' ? room : 'customer';
  const body = drafts[draftKey] ?? '';
  const shownRooms = rooms.filter(item => item.name.toLowerCase().includes(roomQuery.trim().toLowerCase()) && (roomFilter === 'all' || item.lastMessage?.role === 'user'));
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
        throw new Error(data.error || ('Could not send message.'));
      }
      setDrafts(current => current[draftKey] === body ? {...current, [draftKey]: ''} : current);
      setImage(current => current === image ? null : current);
      if (imageInput.current) imageInput.current.value = '';
      await load(undefined, roomRef.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Connection lost.');
    } finally {setSending(false);}
  }

  const selected = rooms.find(item => item.id === room);
  // Presence is a no-op outside AdminPresenceProvider (customer pages).
  const {admins, self, setResource} = useAdminPresence();
  useEffect(() => { if (role === 'admin') setResource(room ? `chat:${room}` : 'chat'); }, [role, room, setResource]);
  const viewersOf = (id: string) => admins.filter(admin => admin.id !== self && admin.resource === `chat:${id}`);
  return <section className={`chat-card card ${role === 'admin' ? 'admin-inbox' : ''} ${compact ? 'chat-compact' : ''}`} aria-label={role === 'admin' ? 'Customer inbox' : 'Consultation'}>
    {role === 'admin' && <aside className="chat-sidebar">
      <h2>{'Conversations'}</h2>
      <label className="chat-search"><span className="sr-only">Search conversations</span><input type="search" placeholder="Search customers" value={roomQuery} onChange={event => setRoomQuery(event.target.value)}/></label>
      <div className="chat-filters" aria-label="Conversation filter"><button type="button" className={roomFilter === 'all' ? 'active' : ''} onClick={() => setRoomFilter('all')}>All</button><button type="button" className={roomFilter === 'needs-reply' ? 'active' : ''} onClick={() => setRoomFilter('needs-reply')}>Needs reply</button></div>
      {loading && <p className="muted" role="status">{'Loading…'}</p>}
      {!loading && rooms.length === 0 && <p className="muted">{'No customer messages yet.'}</p>}
      {!loading && rooms.length > 0 && shownRooms.length === 0 && <p className="muted">No matching conversations.</p>}
      {shownRooms.map(item => {
        return <button type="button" className={`chat-room ${room === item.id ? 'active' : ''}`} aria-current={room === item.id ? 'true' : undefined} key={item.id} onClick={() => {roomRef.current = item.id; setRoom(item.id); setImage(null); if (imageInput.current) imageInput.current.value = ''; setShowRoomList(false);}}>
          <span className="chat-avatar" aria-hidden="true">{item.name.charAt(0).toUpperCase()}</span>
          <span className="chat-room-info"><strong>{item.name}</strong><small>{item.lastMessage?.body ?? ''}</small><PresenceBadges viewers={viewersOf(item.id)} context={`the chat with ${item.name}`}/></span>
          <time dateTime={item.lastMessage?.createdAt}>{item.lastMessage ? new Date(item.lastMessage.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}) : ''}</time>
        </button>;
      })}
    </aside>}
    <div className={`chat-main ${showRoomList ? 'show-room-list' : ''}`}>
      <div className="chat-header"><div>{role === 'admin' && <button type="button" className="inbox-back secondary" onClick={() => setShowRoomList(true)}>← {'Conversations'}</button>}<span className="eyebrow">{role === 'admin' ? 'ADMIN INBOX' : 'DIRECT SUPPORT'}</span><h2>{role === 'admin' ? (selected?.name ?? ('Select a conversation')) : 'Chat with support'}</h2>{role === 'admin' && selected && <PresenceBadges viewers={viewersOf(selected.id)} context="this conversation"/>}</div><span className="live-dot">● {'Demo support'}</span></div>
      <div className="chat-messages" ref={messageArea} role="log" aria-label={'Message history'}>
        {loading && <p className="muted" role="status">{'Loading messages…'}</p>}
        {!loading && !visible.length && <div className="chat-empty"><span aria-hidden="true">✦</span><p>{role === 'admin' ? 'Select a customer to get started.' : 'Hello! Send a question and our team will reply here.'}</p></div>}
        {visible.map(message => <article className={`chat-message ${message.role === role ? 'mine' : ''}`} key={message.id}><small>{message.author} · {new Date(message.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</small>{message.body && <p>{message.body}</p>}{message.image && <img className="chat-image" src={message.image.url} alt={message.image.name}/>}{message.imageExpired && <p className="chat-image-expired">Image removed after 90 days</p>}</article>)}
        <div ref={bottom}/>
      </div>
      <form className="chat-compose" onSubmit={event => {event.preventDefault(); void send();}}><div className="chat-compose-fields"><textarea aria-label={'Message'} value={body} onChange={event => setDrafts(current => ({...current, [draftKey]: event.target.value}))} placeholder={'Write a message…'} maxLength={1000} onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); void send();}}}/><label className="chat-image-picker">{'📷 Choose image (max 1 MB)'}<input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={sending || (role === 'admin' && !room)} onChange={event => {const file = event.target.files?.[0] ?? null; if (file && (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {setError('Only PNG, JPEG, WebP images up to 1 MB.'); event.target.value = ''; setImage(null);} else {setImage(file); setError('');}}}/></label>{image && <div className="chat-image-selected"><span>{image.name}</span><button type="button" className="secondary" onClick={() => {setImage(null); if (imageInput.current) imageInput.current.value = '';}}>{'Remove image'}</button></div>}</div><button type="submit" disabled={(!body.trim() && !image) || sending || (role === 'admin' && !room)}>{sending ? 'Sending…' : 'Send'}</button></form>
      {error && <p className="error-text" role="alert">{error} <button className="secondary" type="button" onClick={() => void load(undefined, roomRef.current)}>{'Retry'}</button></p>}
      {!compact && <p className="field-caption chat-caption">{'Refreshes every 5 seconds. Messages are kept with your account.'}</p>}
    </div>
  </section>;
}
