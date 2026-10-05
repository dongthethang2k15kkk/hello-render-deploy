'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {Role} from '@/lib/admin-session';
import {mergeMessages, watchChat, type LocalMessage} from '@/lib/chat-client';
import {readChatCache, readDrafts, saveChatCache, saveDrafts} from '@/lib/chat-drafts';
import {LoadingRows} from './loading-state';
import {PresenceBadges, useAdminPresence} from './admin-presence';
import {invalidateJson, loadJson} from '@/lib/client-data-cache';

type Room = {id: string; name: string; unread?: number; lastMessage?: {body: string; createdAt: string; role: Role} | null; booking?: {code: string; appointmentStart: string | null} | null};

/** "Paid · JH… · Fri 3 Oct, 19:00": the order this customer is waiting to receive. */
const bookingLabel = (booking: NonNullable<Room['booking']>) => `${booking.appointmentStart ? 'Booked' : 'Paid'} · ${booking.code}${booking.appointmentStart ? ` · ${new Date(booking.appointmentStart).toLocaleString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}` : ' · time not set'}`;

const CACHED_ROOMS = 12;
const CACHED_MESSAGES_PER_ROOM = 60;
const PREFETCHED_ROOMS = 8;

/** Confirmed messages of the most recent conversations; pending sends and local image previews are never cached. */
function cacheSnapshot(rooms: Room[], messages: LocalMessage[], role: Role, current: string) {
  const keep = new Set([current, ...rooms.slice(0, CACHED_ROOMS).map(item => item.id)]);
  const byRoom = new Map<string, LocalMessage[]>();
  for (const message of messages) {
    if (message.status || message.image?.url.startsWith('blob:') || (role === 'admin' && !keep.has(message.room))) continue;
    byRoom.set(message.room, [...(byRoom.get(message.room) ?? []), message]);
  }
  return {rooms: rooms.slice(0, 50), messages: [...byRoom.values()].flatMap(list => list.slice(-CACHED_MESSAGES_PER_ROOM))};
}

/** `lockedRoom` pins an Admin to one customer's conversation (the workspace): no conversation list. */
export default function ChatPanel({role, accountId, compact = false, initialRoom: requestedRoom = '', lockedRoom, lockedTitle}: {role: Role; accountId: string; compact?: boolean; initialRoom?: string; lockedRoom?: string; lockedTitle?: string}) {
  const initialRoom = lockedRoom ?? requestedRoom;
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState(initialRoom);
  const [showRoomList, setShowRoomList] = useState(!initialRoom);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftsRef = useRef<Record<string, string>>({});
  const composer = useRef<HTMLTextAreaElement>(null);
  const roomSearch = useRef<HTMLInputElement>(null);
  useEffect(() => {
    draftsRef.current = readDrafts(accountId); setDrafts(draftsRef.current);
    // Show the conversations this tab already loaded at once; the server copy refreshes them right after.
    const cached = readChatCache<Room, LocalMessage>(accountId);
    if (!cached) return;
    if (cached.rooms.length) setRooms(current => current.length ? current : cached.rooms);
    if (cached.messages.length) {
      setMessages(current => mergeMessages(current, cached.messages));
      if (role === 'user' && !roomRef.current) {roomRef.current = cached.messages[0].room; setRoom(cached.messages[0].room);}
    }
  }, [accountId, role]);
  function updateDraft(key: string, value: string) {
    draftsRef.current = {...draftsRef.current, [key]: value};
    setDrafts(draftsRef.current); saveDrafts(accountId, draftsRef.current);
  }
  useEffect(() => {
    const focusReply = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'r') {event.preventDefault(); composer.current?.focus();}
      if (role === 'admin' && event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof HTMLElement && (event.target.closest('input,textarea,select,[contenteditable=true]')))) {event.preventDefault(); roomSearch.current?.focus();}
    };
    window.addEventListener('keydown', focusReply); return () => window.removeEventListener('keydown', focusReply);
  }, [role]);
  const [image, setImage] = useState<File | null>(null);
  const [roomQuery, setRoomQuery] = useState('');
  const [roomFilter, setRoomFilter] = useState<'all' | 'needs-reply'>('all');
  const [loading, setLoading] = useState(true);
  const [roomsReady, setRoomsReady] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
  const messageArea = useRef<HTMLDivElement>(null);
  const roomRef = useRef(initialRoom);
  const imageInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const nearBottom = useRef(true);
  const cursors = useRef(new Map<string, string>());
  const oldest = useRef(new Map<string, string>());
  const olderAvailable = useRef(new Map<string, boolean>());
  const activeLoad = useRef<{controller: AbortController; room: string} | null>(null);
  const refreshAgain = useRef(false);
  const roomsLoading = useRef(false);
  const roomsRefreshAgain = useRef(false);
  const readIds = useRef(new Map<string, string>());
  const outgoing = useRef(new Map<string, {message: LocalMessage; file: File | null}>());
  const queues = useRef(new Map<string, Promise<void>>());
  const inFlight = useRef(new Set<string>());
  const sendControllers = useRef(new Set<AbortController>());
  const objectUrls = useRef(new Set<string>());
  const prefetched = useRef(false);
  const panel = useRef<HTMLElement>(null);

  /** Loads the latest page of a conversation in the background so opening it later is instant. */
  async function prefetchRoom(id: string) {
    try {
      const response = await fetch(`/api/chat?${new URLSearchParams({rooms: '0', read: '0', room: id})}`, {cache: 'no-store', signal: AbortSignal.timeout(15000)});
      if (!response.ok || !mounted.current) return;
      const data = await response.json();
      if (!mounted.current || cursors.current.has(id)) return;
      setMessages(current => mergeMessages(current, data.messages));
      if (data.cursor) cursors.current.set(id, data.cursor);
      olderAvailable.current.set(id, data.hasOlder);
      if (data.oldest) oldest.current.set(id, data.oldest);
    } catch { /* Opening the conversation loads it normally. */ }
  }

  const loadRooms = useCallback(async () => {
    if (role !== 'admin' || lockedRoom) return;
    if (roomsLoading.current) {roomsRefreshAgain.current = true; return;}
    roomsLoading.current = true;
    try {
      const response = await fetch('/api/chat?rooms=only', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Could not load conversations.');
      const data = await response.json();
      if (!mounted.current) return;
      setRooms(data.rooms);
      if (!roomRef.current && data.rooms[0]) {roomRef.current = data.rooms[0].id; setRoom(data.rooms[0].id);}
      if (!prefetched.current) {
        prefetched.current = true;
        void (async () => { for (const item of data.rooms.slice(0, PREFETCHED_ROOMS) as Room[]) { if (!mounted.current) return; if (item.id !== roomRef.current && !cursors.current.has(item.id)) await prefetchRoom(item.id); } })();
      }
      if (!data.rooms.length) setLoading(false);
    } catch (cause) {if (mounted.current) setError(cause instanceof Error ? cause.message : 'Connection lost.');}
    finally {
      roomsLoading.current = false;
      if (mounted.current) setRoomsReady(true);
      if (roomsRefreshAgain.current && mounted.current) {roomsRefreshAgain.current = false; void loadRooms();}
    }
  }, [role, lockedRoom]);

  const load = useCallback(async (full = false) => {
    const requested = roomRef.current;
    if (!mounted.current || (role === 'admin' && !requested)) return;
    if (activeLoad.current?.room === requested) {refreshAgain.current = true; return;}
    activeLoad.current?.controller.abort();
    const task = {room: requested, controller: new AbortController()};
    activeLoad.current = task;
    const timeout = window.setTimeout(() => task.controller.abort(), 15000);
    try {
      let cursor = cursors.current.get(requested);
      let reconcile = full && Boolean(cursor);
      let more = true;
      while (more && !task.controller.signal.aborted) {
        const query = new URLSearchParams({rooms: '0', read: '0'});
        if (role === 'admin') query.set('room', requested);
        if (cursor) query.set('after', cursor);
        const url = `/api/chat?${query}`;
        let data: any;
        if (role === 'user' && !requested && !cursor) {
          const response = await loadJson<any>(url, {maxAgeMs: 20_000});
          if (!response.ok) throw new Error('Could not load messages.');
          data = response.data;
        } else {
          const response = await fetch(url, {cache: 'no-store', signal: task.controller.signal});
          if (!response.ok) throw new Error('Could not load messages.');
          data = await response.json();
        }
        if (!mounted.current || task.controller.signal.aborted || roomRef.current !== requested) return;
        if (!requested && role === 'user') {roomRef.current = data.room; setRoom(data.room);}
        const key = data.room;
        setMessages(current => mergeMessages(current, data.messages));
        if (!cursor && !oldest.current.has(key)) {
          setHasOlder(data.hasOlder); olderAvailable.current.set(key, data.hasOlder);
          if (data.oldest) oldest.current.set(key, data.oldest);
        }
        if (data.cursor) cursors.current.set(key, data.cursor);
        cursor = data.cursor;
        more = data.hasMore;
        if (!more && reconcile) {reconcile = false; cursor = undefined; more = true;}
        if (!nearBottom.current && data.messages.length) setNewMessages(true);
      }
      setError('');
    } catch (cause) {
      if (mounted.current && activeLoad.current === task && !task.controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Connection lost.');
    } finally {
      window.clearTimeout(timeout);
      if (activeLoad.current === task) {
        activeLoad.current = null;
        if (mounted.current) setLoading(false);
        if (refreshAgain.current) {refreshAgain.current = false; void load(true);}
      }
    }
  }, [role]);

  useEffect(() => {
    mounted.current = true;
    void loadRooms();
    void load(true);
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let messagesChanged = false;
    const unwatch = watchChat(event => {
      if (event.kind === 'disconnected') {setConnected(false); return;}
      if (event.kind === 'connected') {setConnected(true); void load(true); void loadRooms(); return;}
      if (document.visibilityState !== 'visible') return;
      if (event.kind === 'message') {
        // Keep every loaded conversation current, not only the open one, so switching shows the latest at once.
        if (event.message && event.room && (event.room === roomRef.current || cursors.current.has(event.room))) {
          const message = event.message;
          setMessages(current => mergeMessages(current, [message]));
          if (event.room === roomRef.current && !nearBottom.current) setNewMessages(true);
        } else if (!event.message) messagesChanged = true;
      }
      if (!refreshTimer) refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        void loadRooms();
        if (messagesChanged) {messagesChanged = false; void load();}
      }, 100);
    });
    const onVisible = () => {if (document.visibilityState === 'visible') {void load(true); void loadRooms(); setViewVersion(value => value + 1);}};
    document.addEventListener('visibilitychange', onVisible);
    // Low-frequency reconciliation covers missed events, other processes and long-running DB commits.
    const timer = window.setInterval(onVisible, 30000);
    return () => {
      mounted.current = false; unwatch(); clearTimeout(refreshTimer); window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      activeLoad.current?.controller.abort(); activeLoad.current = null;
      sendControllers.current.forEach(controller => controller.abort());
      objectUrls.current.forEach(url => URL.revokeObjectURL(url)); objectUrls.current.clear();
    };
  }, [load, loadRooms]);

  useEffect(() => {
    if (!room) return;
    nearBottom.current = true; setNewMessages(false); setHasOlder(olderAvailable.current.get(room) ?? false); setLoading(true);
    activeLoad.current?.controller.abort(); activeLoad.current = null;
    void load(true);
  }, [load, room]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveChatCache(accountId, cacheSnapshot(rooms, messages, role, roomRef.current)), 400);
    return () => window.clearTimeout(timer);
  }, [accountId, rooms, messages, role]);

  // The full-page chat fills the window below the header, so the reply box is always on screen without scrolling.
  useEffect(() => {
    if (compact) return;
    const fit = () => {
      const element = panel.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.setProperty('--chat-fit-height', `${Math.max(420, Math.round(window.innerHeight - top - 16))}px`);
    };
    fit();
    // The header can grow after load (account pills, fonts), which moves the chat down: measure again whenever it does.
    const observer = new ResizeObserver(() => fit());
    const header = document.querySelector('.site-header, .admin-header');
    if (header) observer.observe(header);
    observer.observe(document.body);
    void document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
  }, [compact]);

  const visible = messages.filter(message => message.room === room);
  const draftKey = room;
  const body = drafts[draftKey] ?? '';
  const shownRooms = rooms.filter(item => item.name.toLowerCase().includes(roomQuery.trim().toLowerCase()) && (roomFilter === 'all' || item.lastMessage?.role === 'user'));
  const latest = visible.at(-1)?.id;
  useEffect(() => {if (nearBottom.current && messageArea.current) messageArea.current.scrollTop = messageArea.current.scrollHeight;}, [latest, room]);
  const latestReply = visible.filter(message => !message.status && message.role !== role).at(-1)?.id;
  useEffect(() => {
    if (!room || !latestReply || document.visibilityState !== 'visible' || !nearBottom.current || readIds.current.get(room) === latestReply) return;
    if (role === 'admin' && showRoomList && window.matchMedia('(max-width: 480px)').matches) return;
    const controller = new AbortController();
    void fetch('/api/chat', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({room, id: latestReply}), signal: controller.signal})
      .then(response => {if (response.ok) {invalidateJson('/api/chat', '/api/auth/session'); readIds.current.set(room, latestReply); setRooms(current => current.map(item => item.id === room ? {...item, unread: 0} : item));}}).catch(() => {});
    return () => controller.abort();
  }, [latestReply, room, role, showRoomList, viewVersion]);

  async function loadOlder() {
    const requested = room;
    const before = oldest.current.get(requested);
    if (!before || loadingOlder) return;
    setLoadingOlder(true);
    const area = messageArea.current;
    const height = area?.scrollHeight ?? 0;
    const top = area?.scrollTop ?? 0;
    try {
      const query = new URLSearchParams({rooms: '0', read: '0', room: requested, before});
      const response = await fetch(`/api/chat?${query}`, {signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('Could not load older messages.');
      const data = await response.json();
      if (!mounted.current || roomRef.current !== requested) return;
      nearBottom.current = false;
      setMessages(current => mergeMessages(current, data.messages)); setHasOlder(data.hasOlder);
      olderAvailable.current.set(requested, data.hasOlder);
      if (data.oldest) oldest.current.set(requested, data.oldest);
      requestAnimationFrame(() => {if (area && roomRef.current === requested) area.scrollTop = top + area.scrollHeight - height;});
    } catch {if (mounted.current) setError('Could not load older messages.');}
    finally {if (mounted.current) setLoadingOlder(false);}
  }

  function enqueue(id: string) {
    const item = outgoing.current.get(id);
    if (!item || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setMessages(current => current.map(message => message.id === id ? {...message, status: 'sending', failure: undefined} : message));
    const previous = queues.current.get(item.message.room) ?? Promise.resolve();
    const task = previous.then(async () => {
      if (!mounted.current) return;
      const controller = new AbortController(); sendControllers.current.add(controller);
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const values = {body: item.message.body, room: item.message.room, clientMessageId: id};
        const payload = new FormData();
        Object.entries(values).forEach(([key, value]) => payload.set(key, value));
        if (item.file) payload.set('image', item.file);
        const response = await fetch('/api/chat', {method: 'POST', signal: controller.signal, ...(item.file ? {body: payload} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(values)})});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not send message.');
        invalidateJson('/api/chat', '/api/auth/session');
        if (!mounted.current) return;
        setMessages(current => mergeMessages(current, [data.message]));
        outgoing.current.delete(id);
        if (item.message.image) {URL.revokeObjectURL(item.message.image.url); objectUrls.current.delete(item.message.image.url);}
        void loadRooms();
      } catch (cause) {
        if (mounted.current) setMessages(current => current.map(message => message.id === id ? {...message, status: 'failed', failure: cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Connection interrupted. Retry safely.'} : message));
      } finally {clearTimeout(timer); sendControllers.current.delete(controller); inFlight.current.delete(id);}
    });
    queues.current.set(item.message.room, task);
    void task.finally(() => {if (queues.current.get(item.message.room) === task) queues.current.delete(item.message.room);});
  }

  function send() {
    const text = body.trim();
    if ((!text && !image) || !room) return;
    const id = crypto.randomUUID();
    const url = image ? URL.createObjectURL(image) : undefined;
    if (url) objectUrls.current.add(url);
    const message: LocalMessage = {id, clientMessageId: id, room, role, author: 'You', body: text, createdAt: new Date().toISOString(), status: 'sending', ...(url && image ? {image: {url, name: image.name}} : {})};
    outgoing.current.set(id, {message, file: image});
    nearBottom.current = true; setNewMessages(false);
    setMessages(current => [...current, message]);
    updateDraft(draftKey, ''); setImage(null); setError('');
    if (imageInput.current) imageInput.current.value = '';
    enqueue(id);
  }

  const selected = rooms.find(item => item.id === room);
  // Presence is a no-op outside AdminPresenceProvider (customer pages).
  const {admins, self, setResource} = useAdminPresence();
  useEffect(() => { if (role === 'admin') setResource(room ? `chat:${room}` : 'chat'); }, [role, room, setResource]);
  const viewersOf = (id: string) => admins.filter(admin => admin.id !== self && admin.resource === `chat:${id}`);
  const inbox = role === 'admin' && !lockedRoom;
  return <section ref={panel} className={`chat-card card ${inbox ? 'admin-inbox' : ''} ${lockedRoom ? 'chat-locked' : ''} ${compact ? 'chat-compact' : ''}`} aria-label={role === 'admin' ? 'Customer inbox' : 'Consultation'}>
    {inbox && <aside className="chat-sidebar">
      <div className="chat-sidebar-tools"><h2>{'Conversations'}</h2>
      <label className="chat-search"><span className="sr-only">Search conversations</span><input ref={roomSearch} type="search" placeholder="Search customers (/ to focus)" value={roomQuery} onChange={event => setRoomQuery(event.target.value)}/></label>
      <div className="chat-filters" aria-label="Conversation filter"><button type="button" className={roomFilter === 'all' ? 'active' : ''} onClick={() => setRoomFilter('all')}>All</button><button type="button" className={roomFilter === 'needs-reply' ? 'active' : ''} onClick={() => setRoomFilter('needs-reply')}>Needs reply</button></div></div>
      {!roomsReady && !rooms.length && <LoadingRows label="Loading conversations" rows={4}/>}
      {roomsReady && rooms.length === 0 && <p className="muted">{'No conversations yet.'}</p>}
      {rooms.length > 0 && shownRooms.length === 0 && <p className="muted">No matching conversations.</p>}
      {shownRooms.map(item => {
        return <button type="button" className={`chat-room ${room === item.id ? 'active' : ''}`} aria-current={room === item.id ? 'true' : undefined} key={item.id} onClick={() => {roomRef.current = item.id; setRoom(item.id); setImage(null); if (imageInput.current) imageInput.current.value = ''; setShowRoomList(false);}}>
          <span className="chat-avatar" aria-hidden="true">{item.name.charAt(0).toUpperCase()}</span>
          <span className="chat-room-info"><strong>{item.name}{item.unread ? <b className="room-unread" aria-label={`${item.unread} unread`}>{item.unread}</b> : null}</strong>{item.booking && <small className="room-booking">{bookingLabel(item.booking)}</small>}<small>{item.lastMessage?.body ?? (item.booking ? 'No messages yet. Say hello!' : '')}</small><PresenceBadges viewers={viewersOf(item.id)} context={`the chat with ${item.name}`}/></span>
          <time dateTime={item.lastMessage?.createdAt}>{item.lastMessage ? new Date(item.lastMessage.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}) : ''}</time>
        </button>;
      })}
    </aside>}
    <div className={`chat-main ${showRoomList ? 'show-room-list' : ''}`}>
      <div className="chat-header"><div>{inbox && <button type="button" className="inbox-back secondary" onClick={() => setShowRoomList(true)}>← {'Conversations'}</button>}<span className="eyebrow">{lockedRoom ? 'CHAT WITH CUSTOMER' : role === 'admin' ? 'ADMIN INBOX' : 'DIRECT SUPPORT'}</span><h2>{role === 'admin' ? (lockedTitle ?? selected?.name ?? ('Select a conversation')) : 'Chat with support'}</h2>{role === 'admin' && selected?.booking && <p className="room-booking">{bookingLabel(selected.booking)}</p>}{role === 'admin' && selected && <PresenceBadges viewers={viewersOf(selected.id)} context="this conversation"/>}</div><span className={`live-dot ${connected ? "" : "reconnecting"}`} role="status">{connected ? "Live updates" : "Reconnecting..."}</span></div>
      <div className="chat-messages" ref={messageArea} onScroll={() => {const area = messageArea.current; if (!area) return; const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80; if (atBottom !== nearBottom.current) setViewVersion(value => value + 1); nearBottom.current = atBottom; if (atBottom) setNewMessages(false);}} role="log" aria-label={'Message history'}>
        {hasOlder && <button type="button" className="secondary chat-history" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? "Loading..." : "Load earlier messages"}</button>}
        {loading && !visible.length && <LoadingRows label="Loading messages"/>}
        {!loading && !visible.length && <div className="chat-empty"><span aria-hidden="true">✦</span><p>{role === 'admin' ? 'Select a customer to get started.' : 'Hello! Send a question and our team will reply here.'}</p></div>}
        {visible.map(message => <article className={`chat-message ${message.role === role ? 'mine' : ''}`} key={message.id}><small>{message.author} · {new Date(message.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</small>{message.body && <p>{message.body}</p>}{message.image && <img className="chat-image" src={message.image.url} alt={message.image.name}/>}{message.imageExpired && <p className="chat-image-expired">Image removed after 90 days</p>}{message.status && <small className={`message-status ${message.status}`} role="status">{message.status === 'sending' ? 'Sending...' : <>{message.failure} <button type="button" className="secondary" onClick={() => enqueue(message.id)}>Retry send</button></>}</small>}{!message.status && message.role === role && <small className="message-status">Sent</small>}</article>)}
      </div>
      {newMessages && <button className="chat-new secondary" type="button" onClick={() => {nearBottom.current = true; if (messageArea.current) messageArea.current.scrollTop = messageArea.current.scrollHeight; setNewMessages(false); setViewVersion(value => value + 1);}}>New messages below</button>}
      {role === 'admin' && room && <details className="chat-quick-replies"><summary>Quick replies</summary><div>{[
        ['Welcome', 'Hi! How can we help with your package or order?'],
        ['Payment steps', 'Please open your order page for payment instructions. After paying, select your available times there.'],
        ['Appointment', 'We will confirm your appointment on your order page. Please return to this chat at the confirmed time.']
      ].map(([label, text]) => <button type="button" className="secondary" key={label} disabled={body.length + text.length + 1 > 1000} onClick={() => {updateDraft(draftKey, body ? `${body}\n${text}` : text); composer.current?.focus();}}>{label}</button>)}</div></details>}
      <form className="chat-compose" onSubmit={event => {event.preventDefault(); void send();}}><div className="chat-compose-fields"><textarea disabled={!room} ref={composer} aria-label={'Message'} title="Reply (Alt+R); Enter to send; Shift+Enter for a new line" value={body} onChange={event => updateDraft(draftKey, event.target.value)} placeholder={'Write a message…'} maxLength={1000} onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); void send();}}}/><label className="chat-image-picker">{'📷 Choose image (max 1 MB)'}<input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={!room} onChange={event => {const file = event.target.files?.[0] ?? null; if (file && (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {setError('Only PNG, JPEG, WebP images up to 1 MB.'); event.target.value = ''; setImage(null);} else {setImage(file); setError('');}}}/></label>{image && <div className="chat-image-selected"><span>{image.name}</span><button type="button" className="secondary" onClick={() => {setImage(null); if (imageInput.current) imageInput.current.value = '';}}>{'Remove image'}</button></div>}</div><button type="submit" disabled={(!body.trim() && !image) || !room}>Send</button></form>
      {error && <p className="error-text" role="alert">{error} <button className="secondary" type="button" onClick={() => void load(true)}>{'Retry'}</button></p>}
      {!compact && <p className="field-caption chat-caption">{'Messages are saved with your account. Failed messages can be retried safely.'}</p>}
    </div>
  </section>;
}
