import {expect, test} from '@playwright/test';
import {registerCustomer} from './helpers';

test('catalog search, sort and empty-state reset preserve access to the packages', async ({page}) => {
  await page.goto('/en');
  const cards = page.locator('.product-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  await page.getByRole('searchbox', {name: 'Search packages'}).fill('no-package-with-this-name-123');
  await expect(page.getByText('No matching packages', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Clear filters'}).click();
  await expect(cards).toHaveCount(count);
  await page.getByLabel('Sort packages', {exact: true}).selectOption('price-high');
  const amounts = await cards.locator('.price-usd').allTextContents();
  const numbers = amounts.map(value => Number(value.replace(/[^\d.]/g, '')));
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
});

test('drafts survive navigation, remain scoped to an account, and quick replies stay editable', async ({browser}) => {
  test.setTimeout(120000);
  const customer = await browser.newContext();
  const admin = await browser.newContext();
  try {
    await registerCustomer(customer.request, 'Draft customer');
    const id = (await (await customer.request.get('/api/auth/session')).json()).account.id;
    const page = await customer.newPage();
    await page.goto('/en/workspace');
    const input = page.getByRole('textbox', {name: 'Message', exact: true});
    await expect(input).toBeEnabled();
    await input.fill('A question I am still writing');
    await page.reload();
    await expect(input).toHaveValue('A question I am still writing');
    await page.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(page.locator('.chat-message').filter({hasText: 'A question I am still writing'}).getByText('Sent', {exact: true})).toBeVisible();
    await admin.request.post('/api/auth/dev-admin');
    const inbox = await admin.newPage();
    await inbox.goto(`/en/admin/chat?room=user:${id}`);
    const reply = inbox.getByRole('textbox', {name: 'Message', exact: true});
    await expect(reply).toBeEnabled();
    await inbox.getByText('Quick replies', {exact: true}).click();
    await inbox.getByRole('button', {name: 'Payment steps', exact: true}).click();
    await expect(reply).toHaveValue(/Please open your order page/);
    await expect(inbox.locator('.chat-message').filter({hasText: 'Please open your order page'})).toHaveCount(0);
    await inbox.keyboard.press('Alt+r');
    await expect(reply).toBeFocused();
    await input.fill('Private unsent draft');
    await page.getByRole('button', {name: 'Log out', exact: true}).click();
    await page.waitForURL(/\/en\/login(?:\?|$)/);
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('shop-chat-drafts:')).length)).toBe(0);
  } finally {await customer.close(); await admin.close();}
});
