import {expect, test, type APIRequestContext, type Browser} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {catalogId, registerCustomer} from './helpers';

// Direct access to the disposable E2E database only (never DATABASE_URL), to move an appointment closer in time.
const db = new PrismaClient({datasourceUrl: process.env.E2E_DATABASE_URL});
test.afterAll(async () => { await db.$disconnect(); });

async function admin(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  const state = await (await context.request.get('/api/admin/settings/payments')).json();
  if (!state.accounts.some((account: {accountNumber: string; active: boolean}) => account.accountNumber === '0123456789' && account.active)) {
    const saved = await context.request.post('/api/admin/settings/payments', {data: {action: 'save-account', bankBin: '970436', accountNumber: '0123456789', accountHolder: 'Nguyen Van Test', active: true}});
    expect(saved.ok(), await saved.text()).toBe(true);
  }
  return context;
}

async function newKey(request: APIRequestContext) {
  const response = await request.post('/api/admin/settings/payments', {data: {action: 'sepay-rotate'}});
  expect(response.ok(), await response.text()).toBe(true);
  const body = await response.json();
  expect(body.sepayKey).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(body.sepay).toMatchObject({configured: true, keyHint: `…${body.sepayKey.slice(-4)}`});
  return body.sepayKey as string;
}

async function placeOrder(request: APIRequestContext) {
  const response = await request.post('/api/orders', {data: {lines: [{productId: await catalogId(request, 'SAMPLE_PLUS'), quantity: 1, delivery: {recipient: 'Auto buyer', note: ''}}]}});
  expect(response.status(), await response.text()).toBe(201);
  const code = (await response.json()).code as string;
  const order = (await (await request.get(`/api/orders/${code}`)).json()).order as {id: string; totalVnd: number};
  return {code, id: order.id, totalVnd: order.totalVnd};
}

let transferId = Date.now();
function sepay(request: APIRequestContext, key: string | null, fields: Record<string, unknown>) {
  transferId += 1;
  const data = {id: transferId, gateway: 'Vietcombank', transactionDate: '2026-09-30 10:00:00', accountNumber: '0123456789', code: null, content: '', transferType: 'in', transferAmount: 0, accumulated: 0, subAccount: null, referenceCode: `FT${transferId}`, description: '', ...fields};
  return request.post('/api/payments/sepay', {data, headers: key ? {Authorization: `Apikey ${key}`} : {}});
}

// The seeded catalog has little stock, so each test cancels its order at the end to put the item back.
async function cancel(request: APIRequestContext, id: string) {
  const response = await request.post(`/api/admin/orders/${id}`, {data: {action: 'cancel', reason: 'E2E cleanup'}});
  expect(response.ok(), await response.text()).toBe(true);
}

const vnLocal = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 16);

test('SePay webhook: rejects bad keys, flags underpayment, marks paid once, then the customer says "free now" and Admin starts', async ({browser}) => {
  test.setTimeout(120000);
  const adminContext = await admin(browser);
  const key = await newKey(adminContext.request);
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Auto Pay Customer');
  const order = await placeOrder(customer.request);

  expect((await sepay(customer.request, null, {content: order.code, transferAmount: order.totalVnd})).status()).toBe(401);
  expect((await sepay(customer.request, 'wrong-key', {content: order.code, transferAmount: order.totalVnd})).status()).toBe(401);

  const underpaid = await sepay(customer.request, key, {content: `${order.code} chuyen khoan`, transferAmount: 1000});
  expect(await underpaid.json()).toMatchObject({success: true, outcome: 'underpaid'});
  expect((await (await customer.request.get(`/api/orders/${order.code}`)).json()).order.status).toBe('awaiting_payment');

  // Banks rewrite the content, so the code is found inside whatever text arrives.
  const paid = await sepay(customer.request, key, {content: `MBVCB.1234.${order.code.toLowerCase()}.CT tu 0071000 toi 0123456789`, transferAmount: order.totalVnd});
  expect(await paid.json()).toMatchObject({success: true, outcome: 'matched'});
  const again = await customer.request.post('/api/payments/sepay', {data: {id: transferId, content: order.code, transferType: 'in', transferAmount: order.totalVnd}, headers: {Authorization: `Apikey ${key}`}});
  expect(await again.json()).toMatchObject({outcome: 'duplicate'});

  const page = await customer.newPage();
  await page.goto(`/en/orders/${order.code}`);
  await expect(page.getByRole('heading', {name: 'Payment received! When are you free?'})).toBeVisible();
  await expect(page.getByText('Payment confirmed automatically from your bank transfer.')).toBeVisible();
  const inbox = await (await customer.request.get('/api/notifications')).json();
  expect(inbox.notifications[0].title).toBe(`Payment received · ${order.code}`);

  await page.getByRole('button', {name: 'Choose my times'}).click();
  const dialog = page.getByRole('dialog', {name: 'When can you receive your order?'});
  await dialog.getByLabel(/I’m free right now/).check();
  await dialog.getByRole('button', {name: 'Send my times'}).click();
  await expect(page.getByText('You are free right now')).toBeVisible();

  const adminPage = await adminContext.newPage();
  await adminPage.goto(`/en/admin/orders/${order.id}`);
  await expect(adminPage.locator('.asap-badge')).toHaveText('Free now');
  await expect(adminPage.getByText('automatic (SePay bank)')).toBeVisible();
  adminPage.once('dialog', confirm => void confirm.accept());
  await adminPage.getByRole('button', {name: 'Start now'}).click();
  await expect(adminPage.getByText('Started now; the customer was messaged in Chat.')).toBeVisible();
  await expect(adminPage.locator('.admin-lede .badge').first()).toHaveText('Appointment booked');

  const chat = await (await customer.request.get('/api/chat')).json();
  expect(chat.messages.at(-1)).toMatchObject({role: 'admin', body: expect.stringContaining(`We are ready for your order ${order.code} now`)});
  const after = await (await customer.request.get('/api/notifications')).json();
  expect(after.notifications[0].title).toBe(`We are ready now · ${order.code}`);

  const settings = await (await adminContext.request.get('/api/admin/settings/payments')).json();
  expect(settings.transfers.filter((item: {orderId: string | null}) => item.orderId === order.id).map((item: {outcome: string}) => item.outcome).sort()).toEqual(['matched', 'underpaid']);
  const activity = await (await adminContext.request.get(`/api/admin/activity?q=${order.code}`)).json();
  expect(activity.entries.map((entry: {action: string}) => entry.action)).toContain('order.payment_detected');
  await cancel(adminContext.request, order.id);
  await customer.close(); await adminContext.close();
});

test('scheduled tick sends one appointment reminder by Chat and Inbox', async ({browser}) => {
  test.setTimeout(150000);
  const adminContext = await admin(browser);
  const key = await newKey(adminContext.request);
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Reminder Customer');
  const order = await placeOrder(customer.request);
  expect(await (await sepay(customer.request, key, {content: order.code, transferAmount: order.totalVnd})).json()).toMatchObject({outcome: 'matched'});

  const later = Date.now() + 90 * 60_000;
  const booked = await adminContext.request.post(`/api/admin/orders/${order.id}`, {data: {action: 'schedule', appointment: {start: vnLocal(later), end: vnLocal(later + 60 * 60_000)}}});
  expect(booked.ok(), await booked.text()).toBe(true);
  // Pretend the time has come: the appointment now starts in 10 minutes.
  await db.order.update({where: {id: order.id}, data: {appointmentStart: new Date(Date.now() + 10 * 60_000), appointmentEnd: new Date(Date.now() + 70 * 60_000)}});

  const reminders = async () => ((await (await customer.request.get('/api/notifications')).json()).notifications as {title: string}[]).filter(item => item.title.startsWith('Appointment at ')).length;
  await expect.poll(async () => {
    const tick = await customer.request.get('/api/cron/tick');
    expect(tick.ok()).toBe(true);
    return reminders();
  }, {timeout: 100_000, intervals: [3000, 10000]}).toBe(1);
  const chat = await (await customer.request.get('/api/chat')).json();
  expect(chat.messages.at(-1).body).toContain(`Reminder: your appointment for order ${order.code} starts at`);
  expect((await db.order.findUnique({where: {id: order.id}}))?.reminderSentAt).not.toBeNull();

  await customer.request.get('/api/cron/tick');
  expect(await reminders()).toBe(1);
  await cancel(adminContext.request, order.id);
  await customer.close(); await adminContext.close();
});
