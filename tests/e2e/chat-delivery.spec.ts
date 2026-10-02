import {expect, test} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {registerCustomer} from './helpers';

const db = new PrismaClient({datasourceUrl: process.env.E2E_DATABASE_URL});
test.afterAll(async () => {await db.$disconnect();});

test('concurrent retries save one message; read acknowledgements cannot clear unseen replies', async ({browser}) => {
  const customer = await browser.newContext();
  const admin = await browser.newContext();
  const stranger = await browser.newContext();
  try {
    await registerCustomer(customer.request, 'Reliable Chat');
    await registerCustomer(stranger.request, 'Other Chat');
    expect((await admin.request.post('/api/auth/dev-admin')).ok()).toBe(true);
    const id = (await (await customer.request.get('/api/auth/session')).json()).account.id;
    const room = `user:${id}`;
    const data = {body: 'Exactly once', clientMessageId: randomUUID()};
    const responses = await Promise.all([customer.request.post('/api/chat', {data}), customer.request.post('/api/chat', {data})]);
    responses.forEach(response => expect(response.ok()).toBe(true));
    const receipts = await Promise.all(responses.map(response => response.json()));
    expect(receipts[0].message.id).toBe(receipts[1].message.id);
    expect(await db.chatMessage.count({where: {customerId: id, body: data.body}})).toBe(1);
    const first = (await (await admin.request.post('/api/chat', {data: {room, body: 'First reply'}})).json()).message;
    const second = (await (await admin.request.post('/api/chat', {data: {room, body: 'Still unread'}})).json()).message;
    expect((await customer.request.get('/api/chat?read=0&rooms=0')).ok()).toBe(true);
    expect((await stranger.request.patch('/api/chat', {data: {room, id: first.id}})).status()).toBe(404);
    expect((await customer.request.patch('/api/chat', {data: {id: first.id}})).ok()).toBe(true);
    expect((await (await customer.request.get('/api/auth/session')).json()).account.chatUnread).toBe(1);
    expect((await customer.request.patch('/api/chat', {data: {id: second.id}})).ok()).toBe(true);
    expect((await (await customer.request.get('/api/auth/session')).json()).account.chatUnread).toBe(0);
  } finally {await customer.close(); await admin.close(); await stranger.close();}
});

test('history and incremental pages retain every message with equal timestamps', async ({browser}) => {
  const customer = await browser.newContext();
  try {
    await registerCustomer(customer.request, 'History Chat');
    const id = (await (await customer.request.get('/api/auth/session')).json()).account.id;
    await db.chatMessage.createMany({data: Array.from({length: 125}, (_, index) => ({customerId: id, authorRole: 'customer', authorName: 'History', body: `History ${index}`, createdAt: new Date('2026-10-02T10:00:00Z')}))});
    const page = async (query = '') => (await (await customer.request.get(`/api/chat?read=0&rooms=0${query}`)).json());
    const latest = await page();
    expect(latest.messages).toHaveLength(60);
    expect(latest.hasOlder).toBe(true);
    const older = await page(`&before=${latest.oldest}`);
    const oldest = await page(`&before=${older.oldest}`);
    expect(oldest.messages).toHaveLength(5);
    expect(new Set([...oldest.messages, ...older.messages, ...latest.messages].map(item => item.id)).size).toBe(125);
    const next = await page(`&after=${oldest.cursor}`);
    expect(next.messages).toHaveLength(60);
    expect(next.hasMore).toBe(true);
    expect((await page(`&after=${next.cursor}`)).messages).toHaveLength(60);
  } finally {await customer.close();}
});

test('optimistic sends survive delayed responses and arrive over SSE in another browser', async ({browser}) => {
  test.setTimeout(120000);
  const customer = await browser.newContext();
  const admin = await browser.newContext();
  try {
    await registerCustomer(customer.request, 'Live Chat');
    const id = (await (await customer.request.get('/api/auth/session')).json()).account.id;
    await customer.request.post('/api/chat', {data: {body: 'Open room'}});
    await admin.request.post('/api/auth/dev-admin');
    const sender = await customer.newPage();
    const receiver = await admin.newPage();
    await sender.goto('/en/workspace');
    await receiver.goto(`/en/admin/chat?room=user:${id}`);
    await expect(sender.getByText('Live updates', {exact: true})).toBeVisible();
    await expect(receiver.getByText('Live updates', {exact: true})).toBeVisible();
    await expect(sender.getByRole('button', {name: 'Send', exact: true})).toBeDisabled();
    // Hold the POST before it reaches the server: the bubble must appear before any receipt exists.
    let release!: () => void;
    const held = new Promise<void>(resolve => {release = resolve;});
    await sender.route('**/api/chat', async route => {
      if (route.request().method() === 'POST') {await held; await route.continue();} else await route.continue();
    });
    await sender.getByRole('textbox', {name: 'Message', exact: true}).fill('Instant bubble');
    await sender.getByRole('button', {name: 'Send', exact: true}).click();
    const bubble = sender.locator('.chat-message').filter({hasText: 'Instant bubble'});
    await expect(bubble).toBeVisible({timeout: 1000});
    await expect(bubble.getByText('Sending...', {exact: true})).toBeVisible();
    release();
    await expect(bubble.getByText('Sent', {exact: true})).toBeVisible();
    // This is shorter than the 30s reconciliation interval, proving events cross the route bundles.
    await expect(receiver.locator('.chat-messages').getByText('Instant bubble', {exact: true})).toBeVisible({timeout: 10000});
    await expect(bubble).toHaveCount(1);
    await sender.unroute('**/api/chat');
    let fail = true;
    await sender.route('**/api/chat', async route => {
      if (fail && route.request().method() === 'POST') {fail = false; await route.fulfill({status: 503, json: {error: 'Please retry'}});} else await route.continue();
    });
    await sender.getByRole('textbox', {name: 'Message', exact: true}).fill('Retry me');
    await sender.getByRole('button', {name: 'Send', exact: true}).click();
    const retry = sender.locator('.chat-message').filter({hasText: 'Retry me'});
    await retry.getByRole('button', {name: 'Retry send'}).click();
    await expect(retry.getByText('Sent', {exact: true})).toBeVisible();
    expect(await db.chatMessage.count({where: {customerId: id, body: 'Retry me'}})).toBe(1);
  } finally {await customer.close(); await admin.close();}
});

test('reconnect catches up; customer streams never disclose another conversation', async ({browser, request}) => {
  test.setTimeout(120000);
  expect((await request.get('/api/chat/events')).status()).toBe(401);
  const customer = await browser.newContext();
  const stranger = await browser.newContext();
  const admin = await browser.newContext();
  try {
    await registerCustomer(customer.request, 'Reconnect Chat');
    await registerCustomer(stranger.request, 'Private Chat');
    await admin.request.post('/api/auth/dev-admin');
    const id = (await (await customer.request.get('/api/auth/session')).json()).account.id;
    await customer.request.post('/api/chat', {data: {body: 'Open reconnect room'}});
    const page = await customer.newPage();
    const otherPage = await stranger.newPage();
    await page.goto('/en/workspace');
    await otherPage.goto('/en');
    await expect(page.getByText('Live updates', {exact: true})).toBeVisible();
    await otherPage.evaluate(() => {
      const state = window as unknown as {chatEvents: {room: string; message?: {body: string}}[]; chatReady: boolean; testSource: EventSource};
      state.chatEvents = []; state.chatReady = false;
      state.testSource = new EventSource('/api/chat/events');
      state.testSource.addEventListener('ready', () => {state.chatReady = true;});
      state.testSource.addEventListener('change', event => {state.chatEvents.push(JSON.parse((event as MessageEvent).data));});
    });
    await expect.poll(() => otherPage.evaluate(() => (window as unknown as {chatReady: boolean}).chatReady)).toBe(true);
    await customer.setOffline(true);
    expect((await admin.request.post('/api/chat', {data: {room: `user:${id}`, body: 'Written while offline'}})).ok()).toBe(true);
    await stranger.request.post('/api/chat', {data: {body: 'Own private message'}});
    await expect.poll(() => otherPage.evaluate(() => (window as unknown as {chatEvents: {message?: {body: string}}[]}).chatEvents.some(event => event.message?.body === 'Own private message'))).toBe(true);
    expect(await otherPage.evaluate(() => (window as unknown as {chatEvents: {message?: {body: string}}[]}).chatEvents.some(event => event.message?.body === 'Written while offline'))).toBe(false);
    await customer.setOffline(false);
    await expect(page.locator('.chat-messages').getByText('Written while offline', {exact: true})).toBeVisible();
    await expect(page.locator('.chat-message').filter({hasText: 'Written while offline'})).toHaveCount(1);
    await otherPage.evaluate(() => (window as unknown as {testSource: EventSource}).testSource.close());
  } finally {await customer.close(); await stranger.close(); await admin.close();}
});
