import {expect, test} from '@playwright/test';
import {registerCustomer} from './helpers';

test('phone: the full-page chat is a full-screen sheet with a back arrow; desktop keeps the page layout', async ({browser}) => {
  test.setTimeout(120000);
  const context = await browser.newContext({viewport: {width: 390, height: 700}, hasTouch: true, isMobile: true});
  await registerCustomer(context.request, 'Chat Sheet Customer');
  const page = await context.newPage();
  await page.goto('/en/workspace');
  const card = page.locator('.chat-card.chat-fullscreen');
  await expect(card).toBeVisible();
  // The sheet covers the whole screen and the page behind cannot scroll, so the keyboard never pushes the site up.
  const box = (await card.boundingBox())!;
  expect(box.x).toBe(0); expect(box.y).toBe(0); expect(box.width).toBe(390); expect(box.height).toBe(700);
  expect(await card.evaluate(element => getComputedStyle(element).position)).toBe('fixed');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  const composer = page.getByRole('textbox', {name: 'Message'});
  await expect(composer).toBeVisible();
  const composerBox = (await composer.boundingBox())!;
  expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(700);
  await page.screenshot({path: 'test-results/chat-sheet-mobile.png'});

  // Shrinking the visible area (what the keyboard does) keeps the reply box inside the sheet.
  await page.setViewportSize({width: 390, height: 380});
  await expect.poll(async () => (await card.boundingBox())!.height).toBe(380);
  expect(((await composer.boundingBox())!.y + (await composer.boundingBox())!.height)).toBeLessThanOrEqual(380);

  // The arrow leaves the chat and gives the page its scrolling back.
  await page.getByRole('link', {name: 'Back to the store'}).click();
  await expect(page).toHaveURL(/\/en$/);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  await context.close();

  const desktop = await browser.newContext({viewport: {width: 1280, height: 800}});
  await registerCustomer(desktop.request, 'Chat Desktop Customer');
  const desktopPage = await desktop.newPage();
  await desktopPage.goto('/en/workspace');
  await expect(desktopPage.locator('.chat-card')).toBeVisible();
  await expect(desktopPage.locator('.chat-card.chat-fullscreen')).toHaveCount(0);
  await expect(desktopPage.locator('.chat-back')).toBeHidden();
  await desktop.close();
});
