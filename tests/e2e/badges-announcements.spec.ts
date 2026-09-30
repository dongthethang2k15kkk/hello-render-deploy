import {expect, test, type Browser} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {catalogId, registerCustomer} from './helpers';

async function admin(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  return context;
}

test('header pills count cart items, unread Inbox messages and unread chat replies', async ({browser}) => {
  const customerContext = await browser.newContext();
  await registerCustomer(customerContext.request, 'Badge Customer');
  const customerId = (await (await customerContext.request.get('/api/auth/session')).json()).account.id as string;
  const page = await customerContext.newPage();
  await page.goto(`/en/products/${await catalogId(page.request, 'SAMPLE_BASIC')}`);
  await page.getByLabel('Recipient name (test data)').fill('Badge');
  await page.getByRole('button', {name: 'Add to cart'}).click();
  await expect(page.getByRole('link', {name: 'Orders, 1 item in cart'})).toBeVisible();

  // The customer writes first, then Admin replies: each side sees the other's unread count.
  expect((await customerContext.request.post('/api/chat', {data: {body: 'Hello shop'}})).ok()).toBe(true);
  const adminContext = await admin(browser);
  const counts = await (await adminContext.request.get('/api/admin/counts')).json();
  expect(counts.chat).toBeGreaterThanOrEqual(1);
  const inbox = await (await adminContext.request.get(`/api/chat?room=user:${customerId}`)).json();
  expect(inbox.rooms.find((room: {id: string}) => room.id === `user:${customerId}`).unread).toBe(0);
  expect((await adminContext.request.post('/api/chat', {data: {body: 'Hi! How can we help?', room: `user:${customerId}`}})).ok()).toBe(true);

  await page.goto('/en');
  await expect(page.getByRole('link', {name: 'Chat, 1 unread'})).toBeVisible();
  await expect(page.locator('.support-launcher .launcher-badge')).toHaveText('1');
  await page.goto('/en/workspace');
  await expect(page.getByText('Hi! How can we help?')).toBeVisible();
  await expect.poll(async () => (await (await page.request.get('/api/auth/session')).json()).account.chatUnread).toBe(0);
  await customerContext.close(); await adminContext.close();
});

test('Admins can be added and removed in Settings', async ({browser, playwright}) => {
  const context = await admin(browser);
  const email = `helper-${Date.now().toString(36)}@gmail.com`;
  const added = await context.request.post('/api/admin/settings/admins', {data: {action: 'add', email}});
  expect(added.ok(), await added.text()).toBe(true);
  expect((await added.json()).admins).toContain(email);
  expect((await context.request.post('/api/admin/settings/admins', {data: {action: 'add', email}})).status()).toBe(409);
  const page = await context.newPage();
  await page.goto('/en/admin/settings/admins');
  await expect(page.getByText(email)).toBeVisible();
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('listitem').filter({hasText: email}).getByRole('button', {name: 'Remove'}).click();
  await expect(page.getByText(`${email} no longer has Admin access.`)).toBeVisible();
  const guest = await playwright.request.newContext({baseURL: 'http://127.0.0.1:3001'});
  expect((await guest.post('/api/admin/settings/admins', {data: {action: 'add', email: 'x@gmail.com'}})).status()).toBe(403);
  await guest.dispose(); await context.close();
});

test('announcement images slide on the store and stay protected while in use', async ({browser, page}) => {
  const context = await admin(browser);
  const png = await readFile('public/horse1.jpg'); // PNG content despite the extension
  const upload = async (name: string) => {
    const response = await context.request.post('/api/admin/product-images', {multipart: {file: {name, mimeType: 'image/png', buffer: png}}});
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()).path as string;
  };
  const first = await upload('one.png');
  const saved = await context.request.post('/api/admin/settings/announcements', {data: {slides: [{imagePath: first, caption: 'Big sale this week', link: '/en#catalog'}, {imagePath: first, caption: 'Second slide', link: ''}], intervalSeconds: 3}});
  expect(saved.ok(), await saved.text()).toBe(true);
  expect((await context.request.delete(`/api/admin/product-images?id=${first.split('/').pop()}`)).status()).toBe(409);

  await expect.poll(async () => { await page.goto('/en'); return page.locator('.announcements').count(); }, {timeout: 45000}).toBe(1);
  await expect(page.getByRole('group', {name: '1 of 2'})).toHaveAttribute('aria-hidden', 'false');
  await page.mouse.move(0, 0);
  await expect(page.getByRole('group', {name: '2 of 2'})).toHaveAttribute('aria-hidden', 'false', {timeout: 10000});
  await page.getByRole('button', {name: 'Previous announcement'}).click();
  await expect(page.getByRole('group', {name: '1 of 2'})).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByRole('img', {name: 'Big sale this week'})).toBeVisible();

  const settingsPage = await context.newPage();
  await settingsPage.goto('/en/admin/settings/announcements');
  await expect(settingsPage.locator('.slide-row')).toHaveCount(2);
  // Leave the shared test database without announcements for the other storefront tests.
  expect((await context.request.post('/api/admin/settings/announcements', {data: {slides: [], intervalSeconds: 6}})).ok()).toBe(true);
  await context.close();
});

test('an expired Admin session sends the Admin to sign in and back to the same page', async ({browser}) => {
  const context = await admin(browser);
  const page = await context.newPage();
  await page.goto('/en/admin/settings/products');
  await expect(page.getByRole('heading', {name: 'Products'})).toBeVisible();
  await context.clearCookies();
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fadmin%2Fsettings%2Fproducts$/, {timeout: 20000});
  await context.close();
});
