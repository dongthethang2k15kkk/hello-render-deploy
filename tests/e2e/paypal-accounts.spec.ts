import {expect, test, type Browser} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {catalogId, registerCustomer} from './helpers';

// Direct access to the disposable E2E database only (never DATABASE_URL), to skip the wait before "I've paid" unlocks.
const db = new PrismaClient({datasourceUrl: process.env.E2E_DATABASE_URL});
// These tests place orders for the sample package and leave them open; give the stock back so later specs (which count on 5) are not starved.
test.afterAll(async () => { await db.package.updateMany({where: {sku: 'SAMPLE_BASIC'}, data: {stockOnHand: 5}}); await db.$disconnect(); });

async function admin(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  return context;
}

const paypalSettings = {action: 'save-paypal', enabled: true, username: 'https://paypal.me/ShopTest', email: 'pay@shop.test', feePercent: 0, feeFixedCents: 0, instructions: 'Send as Friends & Family'};

test('PayPal: Admin sets it up, customer pays by QR and link with a per-order amount, Admin confirms', async ({browser}) => {
  test.setTimeout(120000);
  const adminContext = await admin(browser);
  expect((await adminContext.request.post('/api/admin/settings/payments', {data: {action: 'rate', mode: 'fixed', vndPerUsd: 26000}})).ok()).toBe(true);

  // A pasted link is cleaned to the name; a bad name and an enabled PayPal without a name are refused.
  expect((await adminContext.request.post('/api/admin/settings/payments', {data: {...paypalSettings, username: 'bad name!'}})).status()).toBe(400);
  expect((await adminContext.request.post('/api/admin/settings/payments', {data: {...paypalSettings, username: ''}})).status()).toBe(400);
  const saved = await adminContext.request.post('/api/admin/settings/payments', {data: paypalSettings});
  expect(saved.ok(), await saved.text()).toBe(true);
  expect((await saved.json()).paypal).toMatchObject({enabled: true, username: 'ShopTest', email: 'pay@shop.test'});
  const test1 = await (await adminContext.request.post('/api/admin/settings/payments', {data: {action: 'test-paypal-qr', username: 'ShopTest'}})).json();
  expect(test1.link).toBe('https://paypal.me/ShopTest/1.00USD');
  expect(test1.qrSvg).toContain('<svg');

  const customerContext = await browser.newContext();
  await registerCustomer(customerContext.request, 'PayPal Customer');
  expect((await (await customerContext.request.get('/api/payment-methods')).json()).paypal).toEqual({feePercent: 0, feeFixedCents: 0});
  const page = await customerContext.newPage();
  await page.goto(`/en/products/${await catalogId(page.request, 'SAMPLE_BASIC')}`);
  await page.getByLabel('Recipient name (test data)').fill('PayPal Buyer');
  await page.getByRole('button', {name: 'Add to cart'}).click();
  await page.goto('/en/checkout');
  await page.getByRole('radio', {name: /Schedule a time/}).check();
  await page.getByRole('radio', {name: /PayPal/}).check();
  await expect(page.getByText('Send $10.00 with PayPal · QR code on the next page')).toBeVisible();
  await expect(page.getByText('You pay with PayPal')).toBeVisible();
  await page.getByRole('button', {name: 'Place order →'}).click();
  await expect(page).toHaveURL(/\/en\/orders\/JH[2-9A-Z]{6}$/);
  const code = page.url().split('/').pop()!;

  // 260.000 ₫ at 26.000 is $10.00; open orders left by an earlier run may add cents, so the exact amount is read from the order.
  const order = await (await page.request.get(`/api/orders/${code}`)).json();
  const amount = order.order.cryptoAmount as string;
  expect(amount).toMatch(/^10\.\d\d$/);
  await expect(page.getByText('PAY WITH PAYPAL')).toBeVisible();
  await expect(page.locator('figure.vietqr img')).toHaveAttribute('alt', `PayPal QR code: ${amount} USD to paypal.me/ShopTest`);
  await expect(page.locator('.pay-row', {hasText: 'Amount (USD)'})).toContainText(amount);
  await expect(page.locator('.pay-row', {hasText: 'PayPal.me'})).toContainText('paypal.me/ShopTest');
  await expect(page.locator('.pay-row', {hasText: 'PayPal email'})).toContainText('pay@shop.test');
  await expect(page.getByRole('link', {name: 'Open PayPal'})).toHaveAttribute('href', `https://paypal.me/ShopTest/${amount}USD`);
  await expect(page.getByText('Send as Friends & Family')).toBeVisible();
  expect(order.autoDetect).toBe(false);
  expect(order.paymentUri).toBe(`https://paypal.me/ShopTest/${amount}USD`);
  expect(order.order).toMatchObject({paymentMethod: 'paypal', cryptoRateVnd: 26000, bankSnapshot: {paypalMe: 'ShopTest', email: 'pay@shop.test'}});

  // A second open PayPal order for the same price gets its own cents.
  const second = await page.request.post('/api/orders', {data: {lines: [{productId: await catalogId(page.request, 'SAMPLE_BASIC'), quantity: 1, delivery: {recipient: 'Second'}}], method: 'paypal'}});
  expect(second.status(), await second.text()).toBe(201);
  const secondAmount = (await db.order.findUniqueOrThrow({where: {code: (await second.json()).code}, select: {cryptoAmount: true}})).cryptoAmount!;
  expect(secondAmount).toMatch(/^10\.\d\d$/);
  expect(secondAmount).not.toBe(amount);

  // The PayPal transaction ID is validated, kept in capitals, and a crypto-style ID is refused.
  await db.order.update({where: {code}, data: {createdAt: new Date(Date.now() - 2 * 60_000)}});
  expect((await page.request.post(`/api/orders/${code}`, {data: {action: 'report', paypalTxid: 'short'}})).status()).toBe(400);
  await page.reload();
  await page.getByLabel(/PayPal transaction ID/).fill('5ab12cd34ef567890');
  await page.getByRole('button', {name: 'I’ve paid with PayPal →'}).click();
  await expect(page.getByText('Thanks! We are confirming your payment')).toBeVisible();
  const reported = await db.order.findUniqueOrThrow({where: {code}, select: {id: true, status: true, customerTxid: true, totalVnd: true}});
  expect(reported).toMatchObject({status: 'payment_reported', customerTxid: '5AB12CD34EF567890'});

  // The Admin sees the PayPal details and confirms by hand, like a bank transfer.
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`/en/admin/orders/${reported.id}`);
  await expect(adminPage.getByText('Check PayPal for exactly')).toBeVisible();
  await expect(adminPage.getByText('paypal.me/ShopTest')).toBeVisible();
  await expect(adminPage.getByText('5AB12CD34EF567890').first()).toBeVisible();
  const confirmed = await adminContext.request.post(`/api/admin/orders/${reported.id}`, {data: {action: 'confirm-payment', amountVnd: reported.totalVnd, reference: '5AB12CD34EF567890'}});
  expect(confirmed.ok(), await confirmed.text()).toBe(true);
  expect((await db.order.findUniqueOrThrow({where: {code}, select: {status: true}})).status).toBe('paid');

  await customerContext.close();
  await adminContext.close();
});

test('PayPal: fee is added to the amount, and checkout refuses PayPal when it is switched off', async ({browser}) => {
  const adminContext = await admin(browser);
  expect((await adminContext.request.post('/api/admin/settings/payments', {data: {action: 'rate', mode: 'fixed', vndPerUsd: 26000}})).ok()).toBe(true);
  expect((await adminContext.request.post('/api/admin/settings/payments', {data: {...paypalSettings, username: 'ShopTest', feePercent: 3, feeFixedCents: 30}})).ok()).toBe(true);
  const customerContext = await browser.newContext();
  await registerCustomer(customerContext.request, 'PayPal Fee Customer');
  const line = {productId: await catalogId(customerContext.request, 'SAMPLE_BASIC'), quantity: 1, delivery: {recipient: 'Fee buyer'}};
  expect((await (await customerContext.request.get('/api/payment-methods')).json()).paypal).toEqual({feePercent: 3, feeFixedCents: 30});
  // $10.00 + 3% ($0.30) + $0.30 = $10.60, plus cents only if an open order already uses that amount.
  const priced = await customerContext.request.post('/api/orders', {data: {lines: [line], method: 'paypal'}});
  expect(priced.status(), await priced.text()).toBe(201);
  expect((await db.order.findUniqueOrThrow({where: {code: (await priced.json()).code}, select: {cryptoAmount: true}})).cryptoAmount).toMatch(/^10\.[6-9]\d$/);

  expect((await adminContext.request.post('/api/admin/settings/payments', {data: {...paypalSettings, username: 'ShopTest', enabled: false}})).ok()).toBe(true);
  expect((await (await customerContext.request.get('/api/payment-methods')).json()).paypal).toBeNull();
  const refused = await customerContext.request.post('/api/orders', {data: {lines: [line], method: 'paypal'}});
  expect(refused.status()).toBe(503);
  expect((await refused.json()).error).toContain('PayPal payments are not set up yet');
  await customerContext.close();
  await adminContext.close();
});
