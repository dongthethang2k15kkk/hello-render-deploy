import {expect, test} from '@playwright/test';

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

test('admin inbox is isolated from storefront and links to settings', async ({page}) => {
  const login = await page.request.post('/api/auth/login', {data: {username: 'admin', password: 'admin123'}});
  expect(login.ok()).toBe(true);
  await page.goto('/en/admin');
  await expect(page).toHaveURL(/\/en\/admin\/chat$/);
  await expect(page.getByRole('heading', {name: 'Customer inbox'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Cart'})).toHaveCount(0);
  await page.getByRole('navigation', {name: 'Admin navigation'}).getByRole('link', {name: 'Settings'}).click();
  await expect(page.getByRole('heading', {name: 'Store settings'})).toBeVisible();
});