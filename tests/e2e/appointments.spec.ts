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

/** Places an order as the customer and confirms its payment as the Admin (no appointment yet). */
async function paidOrder(customer: APIRequestContext, adminRequest: APIRequestContext) {
  const response = await customer.post('/api/orders', {data: {lines: [{productId: await catalogId(customer, 'SAMPLE_PLUS'), quantity: 1, delivery: {recipient: 'Appointment buyer', note: ''}}]}});
  expect(response.status(), await response.text()).toBe(201);
  const code = (await response.json()).code as string;
  const order = (await (await customer.get(`/api/orders/${code}`)).json()).order as {id: string; totalVnd: number};
  const confirmed = await adminRequest.post(`/api/admin/orders/${order.id}`, {data: {action: 'confirm-payment', amountVnd: order.totalVnd, reference: 'E2E'}});
  expect(confirmed.ok(), await confirmed.text()).toBe(true);
  return {code, id: order.id};
}

// The seeded catalog has little stock, so each test cancels its order at the end to put the item back.
async function cancel(request: APIRequestContext, id: string) {
  const response = await request.post(`/api/admin/orders/${id}`, {data: {action: 'cancel', reason: 'E2E cleanup'}});
  expect(response.ok(), await response.text()).toBe(true);
}

const vnLocal = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 16);

test('customer says "free right now" and a free Admin starts at once: Chat and Inbox tell the customer', async ({browser}) => {
  test.setTimeout(120000);
  const adminContext = await admin(browser);
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Free Now Customer');
  const order = await paidOrder(customer.request, adminContext.request);

  const page = await customer.newPage();
  await page.goto(`/en/orders/${order.code}`);
  await expect(page.getByRole('heading', {name: 'Payment received! When are you free?'})).toBeVisible();
  await page.getByRole('button', {name: 'Choose my times'}).click();
  const dialog = page.getByRole('dialog', {name: 'When can you receive your order?'});
  await expect(dialog.getByText('Please choose carefully.')).toBeVisible();
  await dialog.getByLabel(/I’m free right now/).check();
  await dialog.getByRole('button', {name: 'Send my times'}).click();
  await expect(page.getByText('You are free right now')).toBeVisible();

  const adminPage = await adminContext.newPage();
  await adminPage.goto(`/en/admin/orders/${order.id}`);
  await expect(adminPage.locator('.asap-badge')).toHaveText('Free now');
  adminPage.once('dialog', confirm => void confirm.accept());
  await adminPage.getByRole('button', {name: 'Start now'}).click();
  await expect(adminPage.getByText('Started now; the customer was messaged in Chat.')).toBeVisible();
  await expect(adminPage.locator('.admin-lede .badge').first()).toHaveText('Appointment booked');

  const chat = await (await customer.request.get('/api/chat')).json();
  expect(chat.messages.at(-1)).toMatchObject({role: 'admin', body: expect.stringContaining(`We are ready for your order ${order.code} now`)});
  const inbox = await (await customer.request.get('/api/notifications')).json();
  expect(inbox.notifications[0].title).toBe(`We are ready now · ${order.code}`);
  await cancel(adminContext.request, order.id);
  await customer.close(); await adminContext.close();
});

test('confirming a payment opens the customer chat so an Admin can write first', async ({browser}) => {
  test.setTimeout(120000);
  const adminContext = await admin(browser);
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Chat First Customer');
  const order = await paidOrder(customer.request, adminContext.request);

  // The customer never wrote, yet the conversation is listed with the paid order and the automatic message.
  const inbox = await (await adminContext.request.get('/api/chat')).json();
  const room = inbox.rooms.find((item: {booking?: {code: string} | null}) => item.booking?.code === order.code);
  expect(room).toMatchObject({name: 'Chat First Customer', booking: {code: order.code, appointmentStart: null}, lastMessage: {role: 'admin', body: expect.stringContaining(`Payment received for order ${order.code}`)}});
  const sent = await adminContext.request.post('/api/chat', {data: {room: room.id, body: 'Hi! We will deliver your order here.'}});
  expect(sent.ok(), await sent.text()).toBe(true);

  const chat = await (await customer.request.get('/api/chat')).json();
  expect(chat.messages.map((message: {body: string}) => message.body)).toEqual([expect.stringContaining('Payment received'), 'Hi! We will deliver your order here.']);

  const adminPage = await adminContext.newPage();
  await adminPage.goto(`/en/admin/chat?room=${room.id}`);
  await expect(adminPage.locator('.chat-header .room-booking')).toHaveText(`Paid · ${order.code} · time not set`);
  await cancel(adminContext.request, order.id);
  await customer.close(); await adminContext.close();
});

test('scheduled tick sends one appointment reminder by Chat and Inbox', async ({browser}) => {
  test.setTimeout(150000);
  const adminContext = await admin(browser);
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Reminder Customer');
  const order = await paidOrder(customer.request, adminContext.request);

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
