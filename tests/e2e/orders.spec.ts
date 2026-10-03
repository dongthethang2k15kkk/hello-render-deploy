import {expect, test, type APIRequestContext, type Browser} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {catalogId, registerCustomer} from './helpers';

// Direct access to the disposable E2E database only (never DATABASE_URL), to simulate an elapsed payment window.
const db = new PrismaClient({datasourceUrl: process.env.E2E_DATABASE_URL});
test.afterAll(async () => { await db.$disconnect(); });

async function admin(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  return context;
}

async function ensureBankAccount(request: APIRequestContext) {
  const state = await (await request.get('/api/admin/settings/payments')).json();
  if (!state.accounts.some((account: {accountNumber: string; active: boolean}) => account.accountNumber === '0123456789' && account.active)) {
    const saved = await request.post('/api/admin/settings/payments', {data: {action: 'save-account', bankBin: '970436', accountNumber: '0123456789', accountHolder: 'Nguyễn Văn Test', active: true}});
    expect(saved.ok(), await saved.text()).toBe(true);
  }
  expect((await request.post('/api/admin/settings/payments', {data: {action: 'rate', mode: 'fixed', vndPerUsd: 26000}})).ok()).toBe(true);
}

/** Skips the one-minute wait before "I've transferred" unlocks (E2E database only). */
async function olderOrder(code: string) {
  await db.order.update({where: {code}, data: {createdAt: new Date(Date.now() - 2 * 60_000)}});
}

async function stockOf(request: APIRequestContext, sku: string) {
  const body = await (await request.get('/api/catalog')).json() as {products: {sku: string; stock: number}[]};
  return body.products.find(product => product.sku === sku)?.stock ?? -1;
}

async function placeOrderByApi(request: APIRequestContext) {
  const response = await request.post('/api/orders', {data: {lines: [{productId: await catalogId(request, 'SAMPLE_PLUS'), quantity: 1, delivery: {recipient: 'API buyer', note: ''}}]}});
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).code as string;
}

test('bank account setup stores the holder the way banks print it and offers a test QR', async ({browser}) => {
  const context = await admin(browser);
  await ensureBankAccount(context.request);
  const state = await (await context.request.get('/api/admin/settings/payments')).json();
  const account = state.accounts.find((item: {accountNumber: string}) => item.accountNumber === '0123456789');
  expect(account).toMatchObject({bankName: 'Vietcombank', accountHolder: 'NGUYEN VAN TEST'});
  const qr = await (await context.request.post('/api/admin/settings/payments', {data: {action: 'test-qr', id: account.id}})).json();
  expect(qr.qrSvg).toContain('<svg');
  await context.close();
});

test('full order: checkout, VietQR, times, admin confirms and books, customer is notified, delivery stays private', async ({browser}) => {
  test.setTimeout(120000);
  const adminContext = await admin(browser);
  await ensureBankAccount(adminContext.request);
  const customerContext = await browser.newContext();
  await registerCustomer(customerContext.request, 'Order Customer');
  const page = await customerContext.newPage();
  const stockBefore = await stockOf(page.request, 'SAMPLE_BASIC');

  await page.goto(`/en/products/${await catalogId(page.request, 'SAMPLE_BASIC')}`);
  await page.getByLabel('Recipient name (test data)').fill('Khánh Vy');
  await page.getByRole('button', {name: 'Add to cart'}).click();
  await expect(page).toHaveURL(/\/en\/cart$/);
  await page.goto('/en/checkout');
  await expect(page.getByText('You pay by bank transfer')).toBeVisible();
  // The time is chosen before paying: schedule two windows (Trade now needs an Admin online).
  await page.getByRole('radio', {name: /Schedule a time/}).check();
  await page.getByRole('button', {name: '+ Add another time'}).click();
  await expect(page.locator('.summary-timing')).toHaveText('Scheduled · 2 times chosen');
  // Customers see USD first; the VND charge stays in small type.
  await expect(page.locator('.summary-total .pay-amount')).toHaveText('$10.00');
  await expect(page.locator('.summary-total .pay-secondary')).toContainText('260.000 ₫');
  await page.getByRole('button', {name: 'Place order →'}).click();
  await expect(page).toHaveURL(/\/en\/orders\/JH[2-9A-Z]{6}$/);
  const code = page.url().split('/').pop()!;

  await expect(page.getByRole('heading', {name: /Price locked · pay within/})).toBeVisible();
  await expect(page.getByRole('img', {name: /VietQR code: 260\.000 ₫ to Vietcombank/})).toBeVisible();
  await expect(page.locator('.pay-row', {hasText: 'Transfer content'})).toContainText(code);
  await expect(page.locator('.pay-row', {hasText: 'Account holder'})).toContainText('NGUYEN VAN TEST');
  await expect(page.locator('.pay-times li')).toHaveCount(2);
  expect(await stockOf(page.request, 'SAMPLE_BASIC')).toBe(stockBefore - 1);

  // The button stays locked for a minute so customers pay first; the server refuses early reports too.
  await expect(page.getByRole('button', {name: 'I’ve transferred →'})).toBeDisabled();
  await expect(page.getByText('The button unlocks 30 seconds after you order.')).toBeVisible();
  const early = await page.request.post(`/api/orders/${code}`, {data: {action: 'report', timeZone: 'Asia/Ho_Chi_Minh', slots: [{start: new Date(Date.now() + 86_400_000).toISOString(), end: new Date(Date.now() + 90_000_000).toISOString()}]}});
  expect(early.status()).toBe(409);
  await olderOrder(code);
  await page.reload();
  // The times came with the order, so "I've transferred" reports at once without asking again.
  await page.getByRole('button', {name: 'I’ve transferred →'}).click();
  await expect(page.getByText('Thanks! We are confirming your payment')).toBeVisible();
  await expect(page.getByRole('dialog', {name: 'When can you receive your order?'})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Thanks! We are confirming your transfer'})).toBeVisible();
  await expect(page.locator('.slot-list li')).toHaveCount(2);

  const needsAction = await (await adminContext.request.get('/api/admin/orders?status=needs-action')).json();
  const listed = needsAction.orders.find((order: {code: string}) => order.code === code);
  expect(listed).toMatchObject({status: 'payment_reported', totalVnd: 260000});

  const adminPage = await adminContext.newPage();
  await adminPage.goto(`/en/admin/orders/${listed.id}`);
  await expect(adminPage.getByRole('heading', {name: `Order ${code}`})).toBeVisible();
  await expect(adminPage.getByLabel('Amount received (VND)')).toHaveValue('260000');
  await adminPage.locator('.slot-choice').first().click();
  await adminPage.getByLabel('Bank reference (optional)').fill('FT-E2E-1');
  await adminPage.getByRole('button', {name: 'Confirm payment & send appointment'}).click();
  await expect(adminPage.getByText('Payment confirmed and appointment sent to the customer.')).toBeVisible();
  await expect(adminPage.locator('.admin-lede .badge')).toHaveText('Appointment booked');
  // No Gmail is connected in tests: emails are logged as skipped, never lost silently.
  await expect(adminPage.locator('.admin-list .badge', {hasText: 'skipped'}).first()).toBeVisible();

  await page.reload();
  await expect(page.locator('.appointment-card')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Add to Google Calendar'})).toHaveAttribute('href', /calendar\.google\.com/);
  const ics = await page.request.get(`/api/orders/${code}/calendar`);
  expect(ics.headers()['content-type']).toContain('text/calendar');
  expect(await ics.text()).toContain('BEGIN:VEVENT');
  const inbox = await (await page.request.get('/api/notifications')).json();
  expect(inbox.unread).toBeGreaterThanOrEqual(2);
  expect(inbox.notifications[0].title).toContain(`Appointment booked · ${code}`);
  await page.goto('/en');
  // Inbox and Orders open small windows over the page; a click on an entry opens its full page.
  const inboxPill = page.getByRole('button', {name: /^Inbox, [1-9]\d* unread$/});
  await inboxPill.click();
  const inboxPanel = page.getByRole('dialog', {name: 'Inbox'});
  await expect(inboxPanel.getByText(`Appointment booked · ${code}`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(inboxPanel).toBeHidden();
  await page.getByRole('button', {name: /^Orders, /}).click();
  const ordersPanel = page.getByRole('dialog', {name: 'Orders'});
  await ordersPanel.getByRole('link', {name: new RegExp(code)}).click();
  await expect(page).toHaveURL(new RegExp(`/en/orders/${code}$`));
  await expect(ordersPanel).toBeHidden();
  await page.goto('/en');
  await page.getByRole('button', {name: /^Inbox, /}).click();
  await page.getByRole('dialog', {name: 'Inbox'}).getByRole('button', {name: new RegExp(`Appointment booked · ${code}`)}).click();
  await expect(page).toHaveURL(new RegExp(`/en/orders/${code}$`));

  await adminPage.getByLabel('Delivery details').fill('Your code: SECRET-CODE-123');
  adminPage.once('dialog', dialog => void dialog.accept());
  await adminPage.getByRole('button', {name: 'Complete transaction'}).click();
  await expect(adminPage.getByText('Transaction completed and recorded; the customer was notified.')).toBeVisible();

  await page.goto(`/en/orders/${code}`);
  await expect(page.getByText('Your code: SECRET-CODE-123')).toBeVisible();
  const stranger = await browser.newContext();
  await registerCustomer(stranger.request, 'Stranger');
  expect((await stranger.request.get(`/api/orders/${code}`)).status()).toBe(404);

  const activity = await (await adminContext.request.get(`/api/admin/activity?q=${code}`)).json();
  expect(activity.entries.map((entry: {action: string}) => entry.action)).toEqual(expect.arrayContaining(['order.payment_confirmed', 'order.completed']));
  const overview = await (await adminContext.request.get('/api/admin/overview')).json();
  expect(overview.revenue.today.vnd).toBeGreaterThanOrEqual(260000);
  await customerContext.close(); await adminContext.close(); await stranger.close();
});

test('customer cancels an unpaid order and the stock returns', async ({browser, request}) => {
  const adminContext = await admin(browser);
  await ensureBankAccount(adminContext.request);
  await registerCustomer(request, 'Cancelling Customer');
  const before = await stockOf(request, 'SAMPLE_PLUS');
  const code = await placeOrderByApi(request);
  expect(await stockOf(request, 'SAMPLE_PLUS')).toBe(before - 1);
  expect((await request.post(`/api/orders/${code}`, {data: {action: 'cancel'}})).ok()).toBe(true);
  expect(await stockOf(request, 'SAMPLE_PLUS')).toBe(before);
  expect((await (await request.get(`/api/orders/${code}`)).json()).order.status).toBe('cancelled');
  await adminContext.close();
});

test('an unpaid order expires after the hold, returns stock, and a late payment can still be confirmed', async ({browser, request}) => {
  const adminContext = await admin(browser);
  await ensureBankAccount(adminContext.request);
  await registerCustomer(request, 'Late Customer');
  const before = await stockOf(request, 'SAMPLE_PLUS');
  const code = await placeOrderByApi(request);
  await db.order.update({where: {code}, data: {holdExpiresAt: new Date(Date.now() - 60_000)}});

  const expired = await (await request.get(`/api/orders/${code}`)).json();
  expect(expired.order.status).toBe('expired');
  expect(await stockOf(request, 'SAMPLE_PLUS')).toBe(before);
  const late = await request.post(`/api/orders/${code}`, {data: {action: 'report', timeZone: 'Asia/Ho_Chi_Minh', slots: [{start: new Date(Date.now() + 86_400_000).toISOString(), end: new Date(Date.now() + 90_000_000).toISOString()}]}});
  expect(late.status()).toBe(409);

  const id = (await db.order.findUniqueOrThrow({where: {code}})).id;
  const confirmed = await adminContext.request.post(`/api/admin/orders/${id}`, {data: {action: 'confirm-payment', amountVnd: 650000, reference: 'late'}});
  expect(confirmed.ok(), await confirmed.text()).toBe(true);
  expect((await confirmed.json()).order.status).toBe('paid');
  expect(await stockOf(request, 'SAMPLE_PLUS')).toBe(before - 1);
  await adminContext.close();
});

test('orders cannot be placed without signing in or with a stale cart', async ({request}) => {
  expect((await request.post('/api/orders', {data: {lines: [{productId: 'sample-basic', quantity: 1, delivery: {recipient: 'x'}}]}})).status()).toBe(401);
  await registerCustomer(request, 'Stale Cart');
  const stale = await request.post('/api/orders', {data: {lines: [{productId: 'not-a-package', quantity: 1, delivery: {}}]}});
  expect(stale.status()).toBe(409);
});

test('Litecoin: wallet with checksum, unique amounts per order, litecoin: QR, TXID and confirmation', async ({browser}) => {
  test.setTimeout(120000);
  const {createHash, randomBytes} = await import('node:crypto');
  const {base58Encode} = await import('../../src/lib/ltc');
  const sha = (data: Uint8Array) => createHash('sha256').update(data).digest();
  // Random bytes: earlier runs leave their (inactive) wallets behind, so the address must be new every time.
  const body = Uint8Array.from([0x30, ...randomBytes(20)]);
  const address = base58Encode(Uint8Array.from([...body, ...sha(sha(body)).subarray(0, 4)]));

  const adminContext = await admin(browser);
  const settings = '/api/admin/settings/payments';
  expect((await adminContext.request.post(settings, {data: {action: 'save-wallet', address: address.slice(0, -1) + (address.endsWith('a') ? 'b' : 'a'), label: 'Typo', active: true}})).status()).toBe(400);
  const added = await adminContext.request.post(settings, {data: {action: 'save-wallet', address, label: 'E2E wallet', active: true}});
  expect(added.ok(), await added.text()).toBe(true);
  const walletId = (await added.json()).wallets.find((wallet: {address: string}) => wallet.address === address).id as string;
  expect((await adminContext.request.post(settings, {data: {action: 'ltc-rate', mode: 'fixed', vndPerLtc: null}})).status()).toBe(400);
  expect((await adminContext.request.post(settings, {data: {action: 'ltc-rate', mode: 'fixed', vndPerLtc: 2000000}})).ok()).toBe(true);
  // Only the E2E wallet is active while this test runs.
  const state = await (await adminContext.request.get(settings)).json();
  for (const wallet of state.wallets) if (wallet.id !== walletId && wallet.active) await adminContext.request.post(settings, {data: {action: 'save-wallet', id: wallet.id, network: wallet.network, address: wallet.address, label: wallet.label, active: false}});

  const customerContext = await browser.newContext();
  await registerCustomer(customerContext.request, 'LTC Customer');
  const methods = await (await customerContext.request.get('/api/payment-methods')).json();
  expect(methods.ltc).toMatchObject({vndPerLtc: 2000000, source: 'fixed'});
  // While Litecoin checkout is on, the store shows an LTC estimate next to USD and VND.
  expect((await (await customerContext.request.get('/api/catalog')).json()).vndPerLtc).toBe(2000000);
  const storePage = await customerContext.newPage();
  await storePage.goto('/en');
  await expect(storePage.locator('.product-card', {hasText: '650.000 ₫'}).first().locator('.price-ltc')).toHaveText('≈ 0.325 LTC');
  await storePage.close();
  const settingsPage = await adminContext.newPage();
  await settingsPage.goto('/en/admin/settings/payments');
  const ltcCard = settingsPage.locator('section', {has: settingsPage.getByRole('heading', {name: 'Litecoin price'})});
  await expect(ltcCard.getByText('2.000.000 ₫ per LTC')).toBeVisible();
  await expect(ltcCard.getByRole('radio', {name: /^Fixed/})).toBeChecked();
  await settingsPage.close();
  const lines = [{productId: await catalogId(customerContext.request, 'SAMPLE_PLUS'), quantity: 1, delivery: {recipient: 'LTC buyer', note: ''}}];
  const first = await (await customerContext.request.post('/api/orders', {data: {lines, method: 'ltc'}})).json();
  const second = await (await customerContext.request.post('/api/orders', {data: {lines, method: 'ltc'}})).json();
  const one = await (await customerContext.request.get(`/api/orders/${first.code}`)).json();
  const two = await (await customerContext.request.get(`/api/orders/${second.code}`)).json();
  // 650,000 VND at 2,000,000 VND/LTC = 0.325 LTC, plus a unique 1-999 litoshi tag.
  expect(one.order.cryptoAmount).toMatch(/^0\.32500\d{3}$/);
  expect(one.order.cryptoAmount).not.toBe('0.32500000');
  expect(two.order.cryptoAmount).not.toBe(one.order.cryptoAmount);
  expect(one.paymentUri).toBe(`litecoin:${address}?amount=${one.order.cryptoAmount}&label=Jewish%20Horse&message=Order%20${first.code}`);
  expect(one.qrSvg).toContain('<svg');

  const page = await customerContext.newPage();
  await page.goto(`/en/orders/${first.code}`);
  await expect(page.getByRole('img', {name: `Litecoin QR code: ${one.order.cryptoAmount} LTC`})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open in wallet app'})).toHaveAttribute('href', one.paymentUri);
  await olderOrder(first.code);
  await page.reload();
  await page.getByRole('button', {name: 'I’ve sent the LTC →'}).click();
  await page.getByLabel('Transaction ID (optional)').fill('ab'.repeat(32));
  await page.getByRole('button', {name: 'Send my times'}).click();
  await expect(page.getByText('We received your times')).toBeVisible();

  const orderId = (await db.order.findUniqueOrThrow({where: {code: first.code}})).id;
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`/en/admin/orders/${orderId}`);
  await expect(adminPage.getByText(`${one.order.cryptoAmount} LTC`).first()).toBeVisible();
  await expect(adminPage.getByLabel('Transaction ID (optional)')).toHaveValue('ab'.repeat(32));
  await adminPage.getByLabel('Book the appointment now').uncheck();
  await adminPage.getByRole('button', {name: 'Confirm payment'}).click();
  await expect(adminPage.getByText('Payment confirmed.')).toBeVisible();

  // Leave no active test wallet or manual price behind for the other tests.
  await adminContext.request.post(settings, {data: {action: 'save-wallet', id: walletId, address, label: 'E2E wallet', active: false}});
  await adminContext.request.post(settings, {data: {action: 'ltc-rate', mode: 'auto', vndPerLtc: null}});
  await customerContext.close(); await adminContext.close();
});
