import {expect, test, type APIRequestContext, type Browser} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {catalogId, registerCustomer} from './helpers';

// Direct access to the disposable E2E database only (never DATABASE_URL).
const db = new PrismaClient({datasourceUrl: process.env.E2E_DATABASE_URL});
test.afterAll(async () => { await db.$disconnect(); });

async function admin(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  return context;
}

async function ensureBank(request: APIRequestContext) {
  const state = await (await request.get('/api/admin/settings/payments')).json();
  if (!state.accounts.some((account: {active: boolean}) => account.active)) {
    expect((await request.post('/api/admin/settings/payments', {data: {action: 'save-account', bankBin: '970436', accountNumber: '0123456789', accountHolder: 'Nguyen Van Test', active: true}})).ok()).toBe(true);
  }
  expect((await request.post('/api/admin/settings/payments', {data: {action: 'rate', mode: 'fixed', vndPerUsd: 26000}})).ok()).toBe(true);
}

const later = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const timing = {timeZone: 'Europe/Berlin', slots: [{start: later(20), end: later(22)}]};
// A valid, unused TRON address (checksum OK), so no real transfer can match the test amounts.
const TRON_ADDRESS = 'TJBfRjSMEYgNV9ttX11fveVayveS73C333';

test('an Admin goes online with one button; customers see it and can pick "Trade now" before paying', async ({browser}) => {
  test.setTimeout(120000);
  const adminContext = await admin(browser);
  await ensureBank(adminContext.request);
  const adminPage = await adminContext.newPage();
  try {
    await adminPage.goto('/en/admin');
    const toggle = adminPage.locator('.availability-toggle');
    if (await toggle.getAttribute('aria-pressed') === 'true') await toggle.click();
    await expect(toggle).toContainText('Go online');

    const customer = await browser.newContext();
    await registerCustomer(customer.request, 'Trade Now Customer');
    const page = await customer.newPage();
    await page.goto('/en');
    await expect(page.locator('.hero .live-status')).toContainText('Away right now');

    await toggle.click();
    await expect(toggle).toContainText('Online — trading');
    expect((await (await customer.request.get('/api/availability')).json()).online).toBeGreaterThanOrEqual(1);
    await page.reload();
    await expect(page.locator('.hero .live-status')).toContainText('Online now');

    // Checkout offers Trade now first and asks for one backup time, then the order keeps both.
    const productId = await catalogId(page.request, 'SAMPLE_BASIC');
    await page.goto(`/en/products/${productId}`);
    await expect(page.locator('.order-summary .live-status')).toContainText('Online now');
    await page.getByLabel('Recipient name (test data)').fill('Trade now');
    await page.getByRole('button', {name: 'Add to cart'}).click();
    await page.goto('/en/checkout');
    const now = page.getByRole('radio', {name: /Trade now/});
    await expect(now).toBeChecked();
    await expect(page.locator('.timing-card .asap-notice')).toContainText('add at least one more time');
    await expect(page.locator('.summary-timing')).toContainText('Trade now, right after payment');
    await page.getByRole('button', {name: 'Place order →'}).click();
    await expect(page).toHaveURL(/\/en\/orders\/JH[2-9A-Z]{6}$/);
    const code = page.url().split('/').pop()!;
    await expect(page.locator('.pay-times')).toContainText('Trade now, right after your payment is confirmed');
    const order = await db.order.findUniqueOrThrow({where: {code}, include: {slots: true}});
    expect(order.asap).toBe(true);
    expect(order.slots).toHaveLength(2);

    // Offline again: Trade now cannot be chosen, the store says "Away".
    await toggle.click();
    await expect(toggle).toContainText('Go online');
    await page.goto(`/en/products/${productId}`);
    await page.getByLabel('Recipient name (test data)').fill('Later');
    await page.getByRole('button', {name: 'Add to cart'}).click();
    await page.goto('/en/checkout');
    await expect(page.getByRole('radio', {name: /Schedule a time/})).toBeChecked();
    await expect(page.getByRole('radio', {name: /Trade now/})).toBeDisabled();
    await expect(page.locator('.timing-option.disabled')).toContainText('Nobody is online right now');
    await page.goto('/en');
    await expect(page.locator('.hero .live-status')).toContainText('Away right now');
    await adminContext.request.post(`/api/admin/orders/${order.id}`, {data: {action: 'cancel', reason: 'E2E cleanup'}});
    await customer.close();
  } finally {
    await adminContext.request.post('/api/admin/availability', {data: {online: false}});
    await adminContext.close();
  }
});

test('USDT (TRC20): the wallet is validated, each order gets its own cent amount, the page warns about the network', async ({browser}) => {
  test.setTimeout(120000);
  const adminContext = await admin(browser);
  await ensureBank(adminContext.request);
  const settings = '/api/admin/settings/payments';
  const typo = await adminContext.request.post(settings, {data: {action: 'save-wallet', network: 'TRC20', address: TRON_ADDRESS.slice(0, -1) + '4', label: 'Typo', active: true}});
  expect(typo.status()).toBe(400);
  expect((await typo.json()).error).toContain('TRON (TRC20)');
  const existing = (await (await adminContext.request.get(settings)).json()).wallets.find((wallet: {address: string}) => wallet.address === TRON_ADDRESS);
  const saved = await adminContext.request.post(settings, {data: {action: 'save-wallet', ...(existing ? {id: existing.id} : {}), network: 'TRC20', address: TRON_ADDRESS, label: 'E2E USDT', active: true}});
  expect(saved.ok(), await saved.text()).toBe(true);
  const walletId = (await (await adminContext.request.get(settings)).json()).wallets.find((wallet: {address: string}) => wallet.address === TRON_ADDRESS).id;
  const customer = await browser.newContext();
  const ids: string[] = [];
  try {
    const admins = await adminContext.newPage();
    await admins.goto('/en/admin/settings/payments');
    await expect(admins.locator('tr', {hasText: TRON_ADDRESS})).toContainText('USDT · TRC20');
    await expect(admins.locator('tr', {hasText: TRON_ADDRESS}).getByRole('link', {name: 'Explorer'})).toHaveAttribute('href', `https://tronscan.org/#/address/${TRON_ADDRESS}`);

    await registerCustomer(customer.request, 'USDT Customer');
    expect((await (await customer.request.get('/api/payment-methods')).json()).usdt).toBe(true);
    const lines = [{productId: await catalogId(customer.request, 'SAMPLE_BASIC'), quantity: 1, delivery: {recipient: 'USDT buyer'}}];
    const first = await customer.request.post('/api/orders', {data: {lines, method: 'usdt', timing}});
    expect(first.status(), await first.text()).toBe(201);
    const second = await customer.request.post('/api/orders', {data: {lines, method: 'usdt', timing}});
    const one = await (await customer.request.get(`/api/orders/${(await first.json()).code}`)).json();
    const two = await (await customer.request.get(`/api/orders/${(await second.json()).code}`)).json();
    ids.push(one.order.id, two.order.id);
    // 260,000 VND at 26,000 VND/USD = $10.00; a second open order on the same wallet pays one cent more.
    expect(one.order.cryptoAmount).toBe('10.00');
    expect(two.order.cryptoAmount).toBe('10.01');
    expect(one.paymentUri).toBe(TRON_ADDRESS);

    const page = await customer.newPage();
    await page.goto(`/en/orders/${one.order.code}`);
    await expect(page.getByText('STEP 1 / PAY WITH USDT (TRC20)')).toBeVisible();
    await expect(page.locator('.pay-row', {hasText: 'TRON address (TRC20)'})).toContainText(TRON_ADDRESS);
    await expect(page.locator('.pay-row', {hasText: 'Amount (USDT)'})).toContainText('10.00');
    await expect(page.locator('.network-warning')).toContainText('TRON (TRC20) network only');
    await expect(page.getByRole('link', {name: 'Open in wallet app'})).toHaveCount(0);
    await db.order.update({where: {id: one.order.id}, data: {createdAt: new Date(Date.now() - 2 * 60_000)}});
    await page.reload();
    await page.getByRole('button', {name: 'I’ve sent the USDT →'}).click();
    await expect(page.getByText('Thanks! We are confirming your payment')).toBeVisible();

    await admins.goto(`/en/admin/orders/${one.order.id}`);
    await expect(admins.getByText('USDT · TRON (TRC20)')).toBeVisible();
    await expect(admins.getByText('10.00 USDT').first()).toBeVisible();
    await expect(admins.getByRole('button', {name: 'Check payment now'})).toBeVisible();
  } finally {
    for (const id of ids) await adminContext.request.post(`/api/admin/orders/${id}`, {data: {action: 'cancel', reason: 'E2E cleanup'}});
    await adminContext.request.post(settings, {data: {action: 'save-wallet', id: walletId, network: 'TRC20', address: TRON_ADDRESS, label: 'E2E USDT', active: false}});
    await customer.close(); await adminContext.close();
  }
});

test('the amount slider is set up in Admin and sells any amount from the store', async ({browser}) => {
  test.setTimeout(120000);
  const adminContext = await admin(browser);
  await ensureBank(adminContext.request);
  const url = '/api/admin/settings/slider';
  const original = (await (await adminContext.request.get(url)).json()).slider;
  try {
    const packageId = await catalogId(adminContext.request, 'SAMPLE_BASIC');
    // One package holds 100 M coins, like the live 100M package: customers pick 100M, 200M, 300M.
    const base = {enabled: true, packageId, title: 'Pick your amount', unitLabel: 'M coins', unitSize: 100, min: 100, max: 300, step: 100, defaultAmount: 100, hideFromGrid: false};
    expect((await adminContext.request.post(url, {data: {...base, min: 500, max: 200}})).status()).toBe(400);
    expect((await adminContext.request.post(url, {data: {...base, step: 50}})).status()).toBe(400);
    expect((await adminContext.request.post(url, {data: base})).ok()).toBe(true);
    const settingsPage = await adminContext.newPage();
    await settingsPage.goto('/en/admin/settings/slider');
    await expect(settingsPage.getByLabel('Show the slider on the store')).toBeChecked();
    await expect(settingsPage.locator('.slider-preview')).toContainText('100 M coins = $10.00');

    const customer = await browser.newContext();
    const page = await customer.newPage();
    await page.goto('/en');
    const card = page.locator('.amount-slider');
    await expect(card.getByRole('heading', {name: 'Pick your amount'})).toBeVisible();
    await expect(card.locator('.amount-slider-price strong')).toHaveText('$10.00');
    await card.getByRole('button', {name: '200', exact: true}).click();
    await expect(card.locator('.amount-slider-price strong')).toHaveText('$20.00');
    await card.getByLabel('Recipient name (test data)').fill('Slider buyer');
    await card.getByRole('button', {name: /^Buy 200 M coins/}).click();
    await expect(page).toHaveURL(/\/en\/cart$/);
    // 200 M coins of a 100M package = 2 packages in the cart.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shop-demo-cart-v1') ?? '[]')[0]?.quantity)).toBe(2);
    await expect(page.getByText('Basic sample package').first()).toBeVisible();
    await customer.close();
  } finally {
    await adminContext.request.post(url, {data: original});
    await adminContext.close();
  }
});

test('Discord sign-in stays hidden until it is configured', async ({page}) => {
  expect((await (await page.request.get('/api/auth/providers')).json()).discord).toBe(false);
  await page.goto('/api/auth/discord/start');
  await expect(page).toHaveURL(/\/en\/login\?error=discord_not_configured$/);
  await expect(page.getByText('Discord sign-in is not configured yet.')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Continue with Discord'})).toHaveCount(0);
});
