import {expect, test} from '@playwright/test';
import {catalogId, registerCustomer} from './helpers';
test('English catalog, delivery form, persisted cart and checkout link', async ({page}) => {
  await registerCustomer(page.request);
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('link', {name: 'Package details'}).first().click();
  await page.getByLabel('Recipient name (test data)').fill('Demo recipient');
  await page.getByRole('button', {name: 'Add to cart'}).click();
  await expect(page.getByRole('status')).toContainText('Added to cart.');
  await page.getByRole('link', {name: 'Cart', exact: true}).click();
  await expect(page).toHaveURL(/\/en\/cart$/);
  await expect(page.getByRole('heading', {name: 'Basic sample package'})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Recipient name (test data): Demo recipient')).toBeVisible();
  await expect(page.getByText('260.000 ₫').first()).toBeVisible();
  await expect(page.getByRole('link', {name: 'Continue to checkout →'})).toBeVisible();
  await page.getByRole('button', {name: 'Remove', exact: true}).click();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
});
test('legacy /vi URLs redirect to English and unknown products 404', async ({page}) => {
  await page.goto('/vi');
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', {level: 1})).toContainText('Digital goods.');
  await expect(page.getByRole('link', {name: 'VI', exact: true})).toHaveCount(0);
  const response = await page.goto('/en/products/not-a-product');
  expect(response?.status()).toBe(404);
});

test('mobile catalog, quantity controls and checkout review', async ({page}) => {
  await page.setViewportSize({width: 390,height: 844});
  const customer = await registerCustomer(page.request);
  await page.goto('/en');
  await expect(page.getByRole('link', {name: 'Package details'})).toHaveCount(2);
  await page.getByRole('link', {name: 'Package details'}).first().click();
  await page.getByLabel('Recipient name (test data)').fill('Demo mobile');
  await page.getByRole('button', {name: 'Add to cart'}).click();
  await page.getByRole('link', {name: 'Cart', exact: true}).click();
  await page.getByRole('button', {name: 'Increase item 1'}).click();
  await expect(page.locator('output')).toHaveText('2');
  await page.request.post('/api/auth/logout');
  await page.getByRole('link', {name: 'Continue to checkout →'}).click();
  await expect(page.getByRole('heading', {name: 'Sign in to purchase'})).toBeVisible();
  await page.getByRole('main').getByRole('link', {name: 'Sign in / Register'}).click();
  await expect(page).toHaveURL(/\/en\/login\?next=checkout$/);
  await page.getByLabel('Email', {exact: true}).fill(customer.email);
  await page.locator('input[autocomplete="current-password"]').fill(customer.password);
  await page.locator('form').getByRole('button', {name: 'Sign in', exact: true}).click();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.getByText('520.000 ₫').first()).toBeVisible();
  await expect(page.getByRole('button', {name: 'Place order →'})).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => {document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0,0);});
  await page.screenshot({path: 'test-results/mobile-checkout.png', fullPage: true});
});

test('desktop storefront layout and screenshot', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/en');
  await expect(page.getByRole('heading', {level:1})).toContainText('experience');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/desktop-storefront.png',fullPage:true});
});

test('public catalog serves the seeded database packages', async ({request}) => {
  const response = await request.get('/api/catalog');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const body = await response.json();
  expect(body.source).toBe('database');
  expect(body.products.map((product: {sku: string}) => product.sku)).toEqual(['SAMPLE_BASIC', 'SAMPLE_PLUS']);
  expect(body.products[0]).toMatchObject({priceVnd: 260000, fields: [{key: 'recipient', labelEn: 'Recipient name (test data)'}]});
  expect(body.vndPerUsd).toBeGreaterThan(0);
});

test('guest keeps a configured item and can edit it before signing in', async ({page}) => {
  await page.goto(`/en/products/${await catalogId(page.request, 'SAMPLE_BASIC')}`);
  await page.getByLabel('Recipient name (test data)').fill('First recipient');
  await page.getByRole('button', {name: 'Add to cart'}).click();
  await expect(page.getByRole('status')).toContainText('Added to cart.');
  await page.getByRole('status').getByRole('link', {name: 'View cart'}).click();
  await expect(page.getByText('Recipient name (test data): First recipient')).toBeVisible();
  await page.getByRole('link', {name: 'Edit details'}).click();
  await expect(page.getByLabel('Recipient name (test data)')).toHaveValue('First recipient');
  await page.getByLabel('Recipient name (test data)').fill('Updated recipient');
  await page.getByRole('button', {name: 'Update cart'}).click();
  await page.getByRole('status').getByRole('link', {name: 'View cart'}).click();
  await expect(page.getByText('Recipient name (test data): Updated recipient')).toBeVisible();
});

test('support dialog closes with Escape', async ({page}) => {
  await page.goto('/en');
  await page.getByRole('button', {name: 'Open support chat'}).click();
  await expect(page.getByRole('dialog', {name: 'Live support'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', {name: 'Live support'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Open support chat'})).toBeFocused();
});
