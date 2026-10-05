import {expect, test, type Browser} from '@playwright/test';
import {registerCustomer} from './helpers';

async function admin(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  return context;
}

test('customers see every team reply as "Admin"; the Admin inbox shows who wrote it', async ({browser}) => {
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Name Check Customer');
  const room = `user:${(await (await customer.request.get('/api/auth/session')).json()).account.id}`;
  expect((await customer.request.post('/api/chat', {data: {body: 'Who is answering?', clientMessageId: crypto.randomUUID()}})).ok()).toBe(true);
  const adminContext = await admin(browser);
  expect((await adminContext.request.post('/api/chat', {data: {room, body: 'Happy to help.', clientMessageId: crypto.randomUUID()}})).ok()).toBe(true);

  const seenByCustomer = await (await customer.request.get('/api/chat')).json();
  expect(seenByCustomer.messages.find((message: {role: string}) => message.role === 'admin').author).toBe('Admin');
  const seenByAdmin = await (await adminContext.request.get(`/api/chat?room=${room}&rooms=0&read=0`)).json();
  expect(seenByAdmin.messages.find((message: {role: string}) => message.role === 'admin').author).not.toBe('Admin');

  // The full-page chat keeps the reply box and Send button on screen on a phone.
  const page = await customer.newPage();
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/en/workspace');
  await expect(page.getByText('Happy to help.')).toBeVisible();
  await expect(page.locator('.chat-message', {hasText: 'Happy to help.'}).locator('small').first()).toContainText('Admin');
  await expect.poll(() => page.locator('.chat-compose button[type=submit]').evaluate(element => element.getBoundingClientRect().bottom <= window.innerHeight)).toBe(true);
  const composerFits = await page.locator('.chat-compose').evaluate(element => {
    const form = element.getBoundingClientRect();
    const textarea = element.querySelector('textarea')!.getBoundingClientRect();
    const picker = element.querySelector('.chat-image-picker')!.getBoundingClientRect();
    const send = element.querySelector('button[type=submit]')!.getBoundingClientRect();
    return form.left >= 0 && form.right <= window.innerWidth && textarea.right <= window.innerWidth && picker.right <= send.left && send.right <= window.innerWidth && send.top >= textarea.bottom;
  });
  expect(composerFits).toBe(true);
  await customer.close(); await adminContext.close();
});

test('an Admin edits the background and the store shows it', async ({browser}) => {
  const adminContext = await admin(browser);
  const url = '/api/admin/settings/background';
  const original = await (await adminContext.request.get(url)).json();
  try {
    const bad = await adminContext.request.post(url, {data: {layers: [{id: 'layer-bad1', imagePath: 'https://example.com/a.jpg', kind: 'floating', x: 10, y: 10, size: 200, opacity: 0.2, rotate: 0, blur: 0, float: false, hideOnMobile: false}]}});
    expect(bad.status()).toBe(400);
    const layer = {id: 'layer-e2e1', imagePath: '/horse3.jpg', kind: 'floating', x: 33, y: 44, size: 240, opacity: 0.3, rotate: 8, blur: 1, float: false, hideOnMobile: false};
    expect((await adminContext.request.post(url, {data: {layers: [layer]}})).ok()).toBe(true);

    const page = await adminContext.newPage();
    await page.goto('/en/admin/settings/background');
    await expect(page.locator('.bg-layer-item')).toHaveCount(1);
    await expect(page.getByRole('heading', {name: 'Background'})).toBeVisible();

    await page.goto('/en');
    const floating = page.locator('.bg-scene .bg-floating');
    await expect(floating).toHaveCount(1);
    await expect(floating).toHaveAttribute('style', /left:\s*33%;\s*top:\s*44%;\s*width:\s*240px/);
    await expect(floating.locator('img')).toHaveAttribute('src', '/horse3.jpg');
  } finally {
    await adminContext.request.post(url, {data: {layers: original.layers}});
    await adminContext.close();
  }
});
