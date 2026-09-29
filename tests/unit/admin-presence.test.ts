import {describe, expect, it} from 'vitest';
import {createPresenceStore, isValidResource, PRESENCE_TTL_MS} from '../../src/lib/admin-presence';

describe('admin presence', () => {
  it('lists admins and moves an admin to the latest resource', () => {
    let now = 1000;
    const store = createPresenceStore(() => now);
    store.beat('a', 'alice', 'alice@gmail.com', 'chat:user:demo-user');
    store.beat('b', 'bob', 'bob@gmail.com', 'settings');
    now += 1000;
    store.beat('a', 'alice', 'alice@gmail.com', 'settings/products');
    expect(store.list().map(e => [e.adminId, e.resource])).toEqual([['a', 'settings/products'], ['b', 'settings']]);
  });
  it('expires entries after the TTL', () => {
    let now = 0;
    const store = createPresenceStore(() => now);
    store.beat('a', 'alice', 'alice@gmail.com', 'chat');
    now = PRESENCE_TTL_MS - 1;
    expect(store.list()).toHaveLength(1);
    now = PRESENCE_TTL_MS + 1;
    expect(store.list()).toHaveLength(0);
  });
  it('removes an admin on leave', () => {
    const store = createPresenceStore(() => 0);
    store.beat('a', 'alice', 'alice@gmail.com', 'chat');
    store.leave('a');
    expect(store.list()).toEqual([]);
  });
  it('accepts only known resources', () => {
    for (const ok of ['chat', 'chat:user:demo-user', 'settings', 'settings/products', 'payments']) expect(isValidResource(ok)).toBe(true);
    for (const bad of ['', 'admin', 'chat:sales', 'settings/../x', '<script>', 42, null]) expect(isValidResource(bad)).toBe(false);
  });
});
