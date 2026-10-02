import {describe, expect, it} from 'vitest';
import {mergeMessages, type LocalMessage} from '../../src/lib/chat-client';
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
