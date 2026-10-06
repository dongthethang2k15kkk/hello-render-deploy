import {describe, expect, it} from 'vitest';
import {chatDividerLabel, chatRows, mergeMessages, type LocalMessage} from '../../src/lib/chat-client';
import {publishChat, subscribeChat} from '../../src/lib/chat-events';

const message = (id: string, extra: Partial<LocalMessage> = {}): LocalMessage => ({id, room: 'user:one', role: 'user', author: 'You', body: id, createdAt: '2026-10-02T12:00:00.000Z', ...extra});

describe('chat reconciliation', () => {
  it('replaces an optimistic message with its receipt, without duplicating an earlier SSE result', () => {
    const pending = message('local', {clientMessageId: 'local', status: 'sending'});
    const saved = message('saved', {clientMessageId: 'local'});
    expect(mergeMessages([pending, saved], [saved])).toEqual([saved]);
  });
  it('keeps unsent messages and newer receipts when an older response arrives', () => {
    const pending = message('pending', {status: 'failed'});
    expect(mergeMessages([pending, message('new')], [message('old')]).map(item => item.id)).toEqual(['new', 'old', 'pending']);
  });
  it('does not match another room or opposite-side message to a pending send', () => {
    const pending = message('pending', {clientMessageId: 'same', status: 'sending'});
    expect(mergeMessages([pending], [message('other', {clientMessageId: 'same', room: 'user:two'}), message('reply', {clientMessageId: 'same', role: 'admin'})])).toHaveLength(3);
  });
  it('orders equal timestamps deterministically and preserves all messages', () => {
    expect(mergeMessages([message('c')], [message('b'), message('a')]).map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
});

it('isolates disconnected subscribers from publishing and removes listeners on cleanup', () => {
  let calls = 0;
  const broken = subscribeChat(() => {throw new Error('Disconnected');});
  const stop = subscribeChat(() => {calls++;});
  publishChat({room: 'user:one', kind: 'message'});
  stop(); broken();
  publishChat({room: 'user:one', kind: 'message'});
  expect(calls).toBe(1);
});

describe('chat layout', () => {
  // Local times, so the checks hold in every time zone.
  const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).toISOString();
  const now = new Date(2026, 9, 6, 18, 0);
  it('groups messages in a row from one side and starts a new group after a pause or a reply', () => {
    const rows = chatRows([
      message('a', {createdAt: at(6, 12, 0)}), message('b', {createdAt: at(6, 12, 1)}), message('c', {createdAt: at(6, 12, 2)}),
      message('d', {role: 'admin', createdAt: at(6, 12, 3)}),
      message('e', {createdAt: at(6, 12, 4)}), message('f', {createdAt: at(6, 12, 10)})
    ], 'user', now);
    expect(rows.map(row => row.position)).toEqual(['first', 'middle', 'last', 'single', 'single', 'single']);
    expect(rows.map(row => row.mine)).toEqual([true, true, true, false, true, true]);
  });
  it('adds a time divider at the start, after 15 minutes and on a new day', () => {
    const rows = chatRows([
      message('a', {createdAt: at(5, 23, 50)}), message('b', {createdAt: at(5, 23, 55)}),
      message('c', {createdAt: at(6, 0, 1)}), message('d', {createdAt: at(6, 0, 20)})
    ], 'user', now);
    expect(rows.map(row => Boolean(row.divider))).toEqual([true, false, true, true]);
    expect(rows[1].position).toBe('last');
    expect(rows[2].position).toBe('single');
  });
  it('labels dividers by how long ago they are', () => {
    expect(chatDividerLabel(new Date(2026, 9, 6, 14, 5), now)).toMatch(/^2:05\sPM$/);
    expect(chatDividerLabel(new Date(2026, 9, 5, 14, 5), now)).toMatch(/^Mon 2:05\sPM$/);
    expect(chatDividerLabel(new Date(2026, 8, 3, 14, 5), now)).toMatch(/^Sep 3, 2:05\sPM$/);
    expect(chatDividerLabel(new Date(2025, 8, 3, 14, 5), now)).toMatch(/^Sep 3, 2025, 2:05\sPM$/);
  });
});
