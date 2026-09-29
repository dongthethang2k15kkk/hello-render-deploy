import {expect, test} from '@playwright/test';
test('English catalog, delivery form, persisted cart and disabled payment', async ({page}) => {
  const session = await page.request.post('/api/auth/login', {data: {username: 'customer', password: 'customer123'}});
  expect(session.ok()).toBe(true);
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
  await expect(page.getByRole('button', {name: 'Payments not enabled'})).toBeDisabled();
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

test('mobile catalog, quantity controls and simulated checkout', async ({page}) => {
  await page.setViewportSize({width: 390,height: 844});
  const session = await page.request.post('/api/auth/login', {data: {username: 'customer', password: 'customer123'}});
  expect(session.ok()).toBe(true);
  await page.goto('/en');
  await expect(page.getByRole('link', {name: 'Package details'})).toHaveCount(2);
  await page.getByRole('link', {name: 'Package details'}).first().click();
  await page.getByLabel('Recipient name (test data)').fill('Demo mobile');
  await page.getByRole('button', {name: 'Add to cart'}).click();
  await page.getByRole('link', {name: 'Cart', exact: true}).click();
  await page.getByRole('button', {name: 'Increase item 1'}).click();
  await expect(page.locator('output')).toHaveText('2');
  await page.request.post('/api/auth/logout');
  await page.getByRole('link', {name: 'Preview checkout'}).click();
  await expect(page.getByRole('heading', {name: 'Sign in to purchase'})).toBeVisible();
  await page.getByRole('main').getByRole('link', {name: 'Sign in / Register'}).click();
  await expect(page).toHaveURL(/\/en\/login\?next=checkout$/);
  await page.getByLabel('Username', {exact: true}).fill('customer');
  await page.locator('input[autocomplete="current-password"]').fill('customer123');
  await page.locator('form').getByRole('button', {name: 'Sign in', exact: true}).click();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await page.getByRole('radio', {name: /Visa/}).check();
  await expect(page.getByRole('radio', {name: /Visa/})).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => {document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0,0);});
  await page.screenshot({path: 'test-results/mobile-checkout.png', fullPage: true});
  await page.getByRole('button', {name: 'Complete simulation'}).click();
  await expect(page.getByRole('heading', {name: 'Preview complete'})).toBeVisible();
});

test('desktop storefront layout and screenshot', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/en');
  await expect(page.getByRole('heading', {level:1})).toContainText('experience');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/desktop-storefront.png',fullPage:true});
});

test('demo quote validates inputs and never enables payment', async ({request}) => {
  const line = {productId: 'sample-basic', quantity: 2, delivery: {recipient: 'Demo'}};
  const valid = await request.post('/api/demo/quote', {data: [line]});
  expect(valid.status()).toBe(200);
  expect(await valid.json()).toEqual({demo: true, currency: 'USD', totalMinor: 2000, paymentEnabled: false});
  for (const data of [[], [{...line, usdCents: 1}], [{...line, quantity: 6}]]) {
    const invalid = await request.post('/api/demo/quote', {data});
    expect(invalid.status()).toBe(400);
  }
});

test('public catalog exposes the same demo packages used by the storefront', async ({request}) => {
  const response = await request.get('/api/catalog');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const body = await response.json();
  expect(body.source).toBe('demo');
  expect(body.products.map((product: {id: string}) => product.id)).toEqual(['sample-basic', 'sample-plus']);
  expect(body.products[0]).toMatchObject({usdCents: 1000, stock: 5, fields: [{key: 'recipient', labelEn: 'Recipient name (test data)'}]});
});

test('guest keeps a configured item and can edit it before signing in', async ({page}) => {
  await page.goto('/en/products/sample-basic');
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
