import {expect, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

test('guest cannot open admin', async ({page}) => {
  await page.goto('/en/admin');
  await expect(page).toHaveURL(/\/en\/login$/);
});

test('customer cannot open admin settings', async ({page}) => {
  const login = await page.request.post('/api/auth/login', {data: {username: 'customer', password: 'customer123'}});
  expect(login.ok()).toBe(true);
  await page.goto('/en/admin/settings');
  await expect(page).toHaveURL(/\/en\/login$/);
});

test('admin password login is rejected; admin must use Google', async ({page}) => {
  const login = await page.request.post('/api/auth/login', {data: {username: 'admin', password: 'admin123'}});
  expect(login.status()).toBe(401);
  await page.goto('/en/login');
  await expect(page.getByText('admin / admin123')).toHaveCount(0);
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
  expect((await customer.request.post('/api/auth/login', {data: {username: 'customer', password: 'customer123'}})).ok()).toBe(true);
  expect((await customer.request.post('/api/chat', {data: {body: 'Presence test'}})).ok()).toBe(true);

  const admin = await browser.newContext();
  expect((await admin.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  const page = await admin.newPage();
  await page.goto('/en/admin/chat');
  await page.getByRole('button', {name: /Demo Customer/}).first().click();

  // Only one admin identity exists locally (dev admin); multi-admin listing is covered by unit tests.
  await expect.poll(async () => {
    const data = await (await admin.request.get('/api/admin/presence')).json();
    return data.admins.map((a: {resource: string}) => a.resource);
  }, {timeout: 10000}).toContain('chat:user:demo-user');

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
