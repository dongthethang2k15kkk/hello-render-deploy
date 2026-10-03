import {expect, test, type Browser} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {catalogId, registerCustomer} from './helpers';

// Direct access to the disposable E2E database only (never DATABASE_URL).
const db = new PrismaClient({datasourceUrl: process.env.E2E_DATABASE_URL});
test.afterAll(async () => { await db.$disconnect(); });

async function admin(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  const state = await (await context.request.get('/api/admin/settings/payments')).json();
  if (!state.accounts.some((account: {active: boolean}) => account.active)) {
    expect((await context.request.post('/api/admin/settings/payments', {data: {action: 'save-account', bankBin: '970436', accountNumber: '0123456789', accountHolder: 'Nguyen Van Test', active: true}})).ok()).toBe(true);
  }
  return context;
}

const soon = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

test('a customer reports a payment, an Admin takes them in the workspace, chats and completes the transaction', async ({browser}) => {
  test.setTimeout(180000);
  const adminContext = await admin(browser);
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Workspace Customer');
  const placed = await customer.request.post('/api/orders', {data: {lines: [{productId: await catalogId(customer.request, 'SAMPLE_BASIC'), quantity: 1, delivery: {recipient: 'Workspace'}}]}});
  expect(placed.status(), await placed.text()).toBe(201);
  const code = (await placed.json()).code as string;
  const report = (slots: {start: string; end: string}[], asap: boolean) => customer.request.post(`/api/orders/${code}`, {data: {action: 'report', timeZone: 'Asia/Ho_Chi_Minh', slots, asap}});

  // "I've transferred" opens 30 seconds after ordering (the server allows a few seconds of clock slack).
  expect((await report([{start: soon(2), end: soon(3)}], false)).status()).toBe(409);
  await db.order.update({where: {code}, data: {createdAt: new Date(Date.now() - 40_000)}});
  // "Free right now" alone is refused: one more time is required.
  const nowOnly = await report([{start: new Date().toISOString(), end: soon(3)}], true);
  expect(nowOnly.status()).toBe(400);
  expect((await nowOnly.json()).error).toContain('add at least one more time');
  const reported = await report([{start: new Date().toISOString(), end: soon(3)}, {start: soon(4), end: soon(5)}], true);
  expect(reported.ok(), await reported.text()).toBe(true);
  const order = await db.order.findUniqueOrThrow({where: {code}});

  const page = await adminContext.newPage();
  await page.goto('/en/admin/workspace');
  const waiting = page.locator('.workspace-queue', {has: page.getByRole('heading', {name: /Waiting for an Admin/})});
  const card = waiting.locator('.workspace-card', {hasText: code});
  await expect(card).toBeVisible();
  await expect(card.locator('.asap-badge')).toHaveText('Free now');
  await card.getByRole('button', {name: 'Take this customer'}).click();
  await expect(page).toHaveURL(new RegExp(`/en/admin/workspace/${order.id}$`));
  await expect(page.locator('.claim-bar.mine')).toContainText('You are handling this order.');

  // The customer's chat sits next to the order; the Admin writes first and the customer sees "Admin".
  const chat = page.locator('.workspace-chat-column');
  await expect(chat.getByRole('heading', {name: 'Workspace Customer'})).toBeVisible();
  await chat.getByRole('textbox', {name: 'Message'}).fill('Hi! I am checking your transfer now.');
  await chat.getByRole('button', {name: 'Send'}).click();
  await expect(chat.locator('.chat-message', {hasText: 'I am checking your transfer'}).locator('.message-status')).toHaveText('Sent');
  const seen = await (await customer.request.get('/api/chat')).json();
  expect(seen.messages.find((message: {body: string}) => message.body.includes('checking your transfer')).author).toBe('Admin');

  // Another Admin owns it: actions are refused until this Admin takes it over.
  await db.order.update({where: {id: order.id}, data: {assignedAdmin: 'other-admin@example.test'}});
  const refused = await adminContext.request.post(`/api/admin/orders/${order.id}`, {data: {action: 'confirm-payment', amountVnd: order.totalVnd, reference: 'E2E'}});
  expect(refused.status()).toBe(409);
  await page.reload();
  await expect(page.locator('.claim-bar.other')).toContainText('other-admin@example.test is handling this order.');
  await expect(page.getByRole('button', {name: /Confirm payment/})).toHaveCount(0);
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', {name: 'Take over'}).click();
  await expect(page.locator('.claim-bar.mine')).toBeVisible();

  // Confirm the payment (no appointment yet), then complete: only completion counts as revenue.
  const revenueBefore = (await (await adminContext.request.get('/api/admin/overview')).json()).revenue.today;
  await page.getByLabel('Book the appointment now').uncheck();
  await page.getByRole('button', {name: 'Confirm payment'}).click();
  await expect(page.getByText('Payment confirmed.')).toBeVisible();
  const afterPayment = (await (await adminContext.request.get('/api/admin/overview')).json()).revenue.today;
  expect(afterPayment.orders).toBe(revenueBefore.orders);
  await page.getByLabel('Delivery details').fill('Your code: WORKSPACE-123');
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', {name: 'Complete transaction'}).click();
  await expect(page.getByText('Transaction completed and recorded; the customer was notified.')).toBeVisible();
  const afterComplete = (await (await adminContext.request.get('/api/admin/overview')).json()).revenue.today;
  expect(afterComplete.orders).toBe(revenueBefore.orders + 1);
  expect(afterComplete.vnd).toBe(revenueBefore.vnd + order.totalVnd);

  // Claim events stay internal: the customer's timeline does not show them.
  const customerView = await (await customer.request.get(`/api/orders/${code}`)).json();
  expect(customerView.order.events.map((event: {action: string}) => event.action)).not.toContain('claimed');
  await customer.close(); await adminContext.close();
});
