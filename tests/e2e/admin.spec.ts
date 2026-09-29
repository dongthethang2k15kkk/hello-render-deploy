import {expect, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {registerCustomer} from './helpers';

test('guest cannot open admin', async ({page}) => {
  await page.goto('/en/admin');
  await expect(page).toHaveURL(/\/en\/login$/);
});

test('customer cannot open admin settings', async ({page}) => {
  await registerCustomer(page.request);
  await page.goto('/en/admin/settings');
  await expect(page).toHaveURL(/\/en\/login$/);
});

test('password sign-in never grants admin; admin must use Google', async ({page}) => {
  const login = await page.request.post('/api/auth/login', {data: {email: 'admin@example.test', password: 'admin123'}});
  expect(login.status()).toBe(401);
  const customer = await registerCustomer(page.request);
  expect((await (await page.request.get('/api/auth/session')).json()).account).toMatchObject({role: 'user', name: customer.name});
  expect((await page.request.get('/api/admin/customers')).status()).toBe(403);
  await page.goto('/en/login');
  await expect(page.getByText('customer123')).toHaveCount(0);
});

test('admin inbox is isolated from storefront and links to settings', async ({page}) => {
  // Dev admin session (ALLOW_DEV_ADMIN_LOGIN=1, non-production) stands in for Google sign-in.
  const login = await page.request.post('/api/auth/dev-admin');
  expect(login.ok()).toBe(true);
  await page.goto('/en/admin');
  await expect(page).toHaveURL(/\/en\/admin\/chat$/);
  await expect(page.getByRole('heading', {name: 'Customer inbox'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Cart'})).toHaveCount(0);
  await page.getByRole('navigation', {name: 'Admin navigation'}).getByRole('link', {name: 'Settings'}).click();
  await expect(page.getByRole('heading', {name: 'Store settings'})).toBeVisible();
});

test('admin presence heartbeat tracks the open customer chat and settings page', async ({browser, request}) => {
  // A customer message creates the room admins can open.
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Presence Customer');
  const customerId = (await (await customer.request.get('/api/auth/session')).json()).account.id as string;
  expect((await customer.request.post('/api/chat', {data: {body: 'Presence test'}})).ok()).toBe(true);

  const admin = await browser.newContext();
  expect((await admin.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  const page = await admin.newPage();
  await page.goto('/en/admin/chat');
  await page.getByRole('button', {name: /Presence Customer/}).first().click();

  // Only one admin identity exists locally (dev admin); multi-admin listing is covered by unit tests.
  await expect.poll(async () => {
    const data = await (await admin.request.get('/api/admin/presence')).json();
    return data.admins.map((a: {resource: string}) => a.resource);
  }, {timeout: 10000}).toContain(`chat:user:${customerId}`);

  await page.getByRole('navigation', {name: 'Admin navigation'}).getByRole('link', {name: 'Settings'}).click();
  await expect.poll(async () => (await (await admin.request.get('/api/admin/presence')).json()).admins[0]?.resource, {timeout: 10000}).toBe('settings');
  expect((await request.get('/api/admin/presence')).status()).toBe(403);
  await customer.close(); await admin.close();
});

test('admin can choose a product image without entering a path', async ({page}) => {
  expect((await page.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  await page.route('**/api/admin/products', async route => {
    if (route.request().method() === 'GET') await route.fulfill({json: {products: []}});
    else await route.fulfill({status: 500, json: {error: 'Save is outside this focused upload test'}});
  });
  await page.route('**/api/admin/product-images', route => route.fulfill({status: 201, json: {path: '/api/product-images/cmh123abc', sizeBytes: 171734, mimeType: 'image/jpeg', reused: false}}));
  await page.route('**/api/product-images/cmh123abc', async route => route.fulfill({contentType: 'image/jpeg', body: await readFile(path.resolve('public/horse1.jpg'))}));

  await page.goto('/en/admin/settings/products');
  await expect(page.getByText('No image yet')).toBeVisible();
  await page.locator('.admin-image-dropzone input').setInputFiles('public/horse1.jpg');
  await expect(page.getByText(/Image uploaded/)).toBeVisible();
  await expect(page.getByRole('img', {name: 'Preview of product image'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Save product'}).first()).toBeEnabled();
  await expect(page.getByText('Image path')).toHaveCount(0);
});

test('admin sees why a visible product is missing from the store', async ({page}) => {
  expect((await page.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  const product = {id: 'p1', slug: 'khanh-vy', active: true, category: 'general', sortOrder: 0, imagePath: '', translations: {en: {title: 'Khánh Vy', description: ''}}, packages: [{sku: 'KV1', baseUsdCents: 100, saleUsdCents: null, stockOnHand: 0, active: false, translations: {en: {title: 'Standard', description: ''}}, fields: []}]};
  await page.route('**/api/admin/products', route => route.fulfill({json: {products: [product]}}));

  await page.goto('/en/admin/settings/products');
  await expect(page.locator('.admin-store-status')).toHaveText(/Not in store/);
  await page.locator('.admin-product-open', {hasText: 'Khánh Vy'}).click();
  await expect(page.locator('.admin-store-note')).toContainText('Turn on “Package available”');
  await page.getByRole('checkbox', {name: /Package available/}).check();
  await expect(page.locator('.admin-store-note')).toContainText('out of stock');
  await page.getByLabel('Stock available').fill('5');
  await expect(page.locator('.admin-store-note')).toHaveCount(0);
});
