import {expect, test, type APIRequestContext, type Browser} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {registerCustomer, uniqueEmail} from './helpers';

async function adminContext(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  return context;
}

async function customerIdFor(admin: APIRequestContext, email: string) {
  const body = await (await admin.get(`/api/admin/customers?q=${encodeURIComponent(email)}`)).json();
  expect(body.customers).toHaveLength(1);
  return body.customers[0].id as string;
}

const session = async (request: APIRequestContext) => (await (await request.get('/api/auth/session')).json()).account;

test('customer registers in the UI, signs out and signs back in with email', async ({page}) => {
  const email = uniqueEmail('ui');
  await page.goto('/en/login');
  await page.getByRole('button', {name: 'Register'}).click();
  await page.getByLabel('Full name').fill('Khánh Vy');
  await page.getByLabel('Email', {exact: true}).fill(email);
  await page.locator('input[autocomplete="new-password"]').first().fill('first-password-1');
  await page.getByLabel('Confirm password').fill('first-password-1');
  await page.getByRole('button', {name: 'Create account'}).click();
  await expect(page).toHaveURL(/\/en\/workspace$/);
  await expect(page.getByRole('link', {name: 'Khánh Vy'})).toBeVisible();

  await page.getByRole('button', {name: 'Log out'}).click();
  await expect(page.getByRole('link', {name: 'Khánh Vy'})).toHaveCount(0);
  await page.goto('/en/login');
  await page.getByLabel('Email', {exact: true}).fill(email.toUpperCase());
  await page.locator('input[autocomplete="current-password"]').fill('first-password-1');
  await page.locator('form').getByRole('button', {name: 'Sign in', exact: true}).click();
  await expect(page).toHaveURL(/\/en\/workspace$/);
  await page.getByRole('link', {name: 'Khánh Vy'}).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  await expect(page.getByText(email)).toBeVisible();
});

test('duplicate emails are rejected and repeated wrong passwords are blocked', async ({request, playwright}) => {
  const customer = await registerCustomer(request);
  expect((await request.post('/api/auth/register', {data: {...customer, name: 'Copy'}})).status()).toBe(409);
  const guest = await playwright.request.newContext({baseURL: 'http://127.0.0.1:3001'});
  for (let attempt = 0; attempt < 5; attempt++) expect((await guest.post('/api/auth/login', {data: {email: customer.email, password: 'wrong-password'}})).status()).toBe(401);
  const blocked = await guest.post('/api/auth/login', {data: {email: customer.email, password: customer.password}});
  expect(blocked.status()).toBe(429);
  await guest.dispose();
});

test('admin sets a new password: old sessions end and the customer must change it', async ({browser}) => {
  const customerContext = await browser.newContext();
  const customer = await registerCustomer(customerContext.request, 'Forgetful Customer');
  const admin = await adminContext(browser);
  const id = await customerIdFor(admin.request, customer.email);

  expect((await admin.request.post(`/api/admin/customers/${id}`, {data: {action: 'set-password', password: 'temp-pass-9876', requireChange: true}})).ok()).toBe(true);
  expect(await session(customerContext.request)).toBeNull();
  expect((await customerContext.request.post('/api/auth/login', {data: {email: customer.email, password: customer.password}})).status()).toBe(401);

  const page = await customerContext.newPage();
  await page.goto('/en/login');
  await page.getByLabel('Email', {exact: true}).fill(customer.email);
  await page.locator('input[autocomplete="current-password"]').fill('temp-pass-9876');
  await page.locator('form').getByRole('button', {name: 'Sign in', exact: true}).click();
  await expect(page).toHaveURL(/\/en\/account\?required=1$/);
  await expect(page.getByText('Please set a new password.')).toBeVisible();
  await page.getByLabel('Temporary password').fill('temp-pass-9876');
  await page.getByLabel('New password', {exact: true}).fill('my-own-password-2');
  await page.getByLabel('Confirm new password').fill('my-own-password-2');
  await page.getByRole('button', {name: 'Save password'}).click();
  await expect(page.getByText('Password updated.')).toBeVisible();
  await expect(page.getByText('Please set a new password.')).toHaveCount(0);

  const audit = (await (await admin.request.get(`/api/admin/customers/${id}`)).json()).audit;
  expect(audit[0].summary).toContain('Set a new password');
  await customerContext.close(); await admin.close();
});

test('admin locks and unlocks an account from the customer page', async ({browser}) => {
  const customerContext = await browser.newContext();
  const customer = await registerCustomer(customerContext.request, 'Lockable Customer');
  const admin = await adminContext(browser);
  const page = await admin.newPage();
  await page.goto('/en/admin/customers');
  await page.getByPlaceholder('Name or email').fill(customer.email);
  await page.getByRole('button', {name: 'Apply'}).click();
  await page.getByRole('link', {name: new RegExp(customer.email)}).click();
  await expect(page.getByRole('heading', {name: 'Lockable Customer'})).toBeVisible();
  await expect(page.getByRole('cell', {name: 'Registered'})).toBeVisible();

  await page.getByLabel('Reason (visible to Admin only)').fill('E2E check');
  await page.getByRole('button', {name: 'Lock account'}).click();
  await expect(page.getByText('Account locked and signed out everywhere.')).toBeVisible();
  expect(await session(customerContext.request)).toBeNull();
  expect((await customerContext.request.post('/api/auth/login', {data: {email: customer.email, password: customer.password}})).status()).toBe(403);

  await page.getByRole('button', {name: 'Unlock account'}).click();
  await expect(page.getByText('Account unlocked.')).toBeVisible();
  expect((await customerContext.request.post('/api/auth/login', {data: {email: customer.email, password: customer.password}})).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole('cell', {name: 'Account locked'})).toBeVisible();
  await customerContext.close(); await admin.close();
});

test('sign-in activity can be filtered to failed attempts', async ({browser, request}) => {
  const customer = await registerCustomer(request, 'Activity Customer');
  expect((await request.post('/api/auth/login', {data: {email: customer.email, password: 'not-it'}})).status()).toBe(401);
  const admin = await adminContext(browser);
  const page = await admin.newPage();
  await page.goto('/en/admin/customers?tab=activity');
  await page.getByLabel('Email or IP').fill(customer.email);
  await page.getByLabel('Result').selectOption('failed');
  await page.getByRole('button', {name: 'Apply'}).click();
  await expect(page.getByText('1 event ·')).toBeVisible();
  await expect(page.getByRole('cell', {name: 'Wrong password'})).toBeVisible();
  await expect(page.getByText('password_hash')).toHaveCount(0);
  await admin.close();
});

test('chat survives in the database and chat images are private', async ({browser}) => {
  const owner = await browser.newContext();
  await registerCustomer(owner.request, 'Image Owner');
  const image = await readFile('public/horse1.jpg'); // PNG content despite the extension
  const sent = await owner.request.post('/api/chat', {multipart: {body: 'Here is my screenshot', image: {name: 'shot.png', mimeType: 'image/png', buffer: image}}});
  expect(sent.ok(), await sent.text()).toBe(true);
  const url = (await sent.json()).message.image.url as string;
  expect(url).toMatch(/^\/api\/chat\/images\/[a-z0-9]+$/);
  expect((await owner.request.get(url)).status()).toBe(200);

  const stranger = await browser.newContext();
  await registerCustomer(stranger.request, 'Stranger');
  expect((await stranger.request.get(url)).status()).toBe(404);
  expect((await (await stranger.request.get('/api/chat')).json()).messages).toHaveLength(0);

  const admin = await adminContext(browser);
  expect((await admin.request.get(url)).status()).toBe(200);
  const rooms = (await (await admin.request.get('/api/chat')).json()).rooms as {name: string}[];
  expect(rooms.some(room => room.name === 'Image Owner')).toBe(true);
  await owner.close(); await stranger.close(); await admin.close();
});

test('customer signs out other devices from the account page', async ({browser}) => {
  const first = await browser.newContext();
  const customer = await registerCustomer(first.request, 'Two Devices');
  const second = await browser.newContext();
  expect((await second.request.post('/api/auth/login', {data: {email: customer.email, password: customer.password}})).ok()).toBe(true);
  const page = await first.newPage();
  page.on('dialog', dialog => void dialog.accept());
  await page.goto('/en/account');
  await page.getByRole('button', {name: 'Sign out of other devices'}).click();
  await expect(page.getByText('Other devices were signed out.')).toBeVisible();
  expect(await session(second.request)).toBeNull();
  expect(await session(first.request)).toMatchObject({name: 'Two Devices'});
  await first.close(); await second.close();
});

test('forgot password page shows the Discord contact', async ({page}) => {
  await page.goto('/en/login');
  await page.getByRole('link', {name: 'Forgot your password?'}).click();
  await expect(page.getByRole('heading', {name: 'Forgot password?'})).toBeVisible();
  await expect(page.getByRole('img', {name: /Discord invite QR code/})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open the shop’s Discord'})).toHaveAttribute('href', 'https://discord.gg/pD4MdsJB');
  expect((await page.request.get('/contact/discord-qr.png')).headers()['content-type']).toContain('image/png');
  await page.goto('/en/privacy');
  await expect(page.getByText('deleted automatically after 90 days')).toBeVisible();
});

test('admin deletes an account only with the exact email', async ({browser}) => {
  const customerContext = await browser.newContext();
  const customer = await registerCustomer(customerContext.request, 'Leaving Customer');
  const admin = await adminContext(browser);
  const id = await customerIdFor(admin.request, customer.email);
  expect((await admin.request.post(`/api/admin/customers/${id}`, {data: {action: 'delete', confirmEmail: 'someone@else.test'}})).status()).toBe(400);
  expect((await admin.request.post(`/api/admin/customers/${id}`, {data: {action: 'delete', confirmEmail: customer.email}})).ok()).toBe(true);
  expect((await admin.request.get(`/api/admin/customers/${id}`)).status()).toBe(404);
  expect(await session(customerContext.request)).toBeNull();
  await customerContext.close(); await admin.close();
});
