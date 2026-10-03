import {expect, test} from '@playwright/test';
import {registerCustomer} from './helpers';

test('a short catalog skips search and sort; the quick buy box goes straight to checkout', async ({page}) => {
  await page.goto('/en');
  await expect(page.locator('.product-card')).toHaveCount(2);
  await expect(page.getByRole('searchbox', {name: 'Search packages'})).toHaveCount(0);
  const box = page.locator('.quick-buy');
  await box.getByRole('radio', {name: /Extended sample package/}).click();
  await box.getByRole('button', {name: 'More'}).click();
  await expect(box.locator('.amount-slider-price strong')).toHaveText('$50.00');
  await box.getByLabel('Recipient name (test data)').fill('Quick buyer');
  await box.getByRole('button', {name: /^Buy Extended sample package × 2/}).click();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.locator('.summary-line')).toContainText('Extended sample package × 2');
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
