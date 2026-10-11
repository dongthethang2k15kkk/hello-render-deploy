import {expect, test, type APIRequestContext, type Browser} from '@playwright/test';
import {PrismaClient} from '@prisma/client';
import {catalogId, registerCustomer} from './helpers';

// Direct access to the disposable E2E database only (never DATABASE_URL), to look inside orders and age them.
const db = new PrismaClient({datasourceUrl: process.env.E2E_DATABASE_URL});
// These tests place orders for the sample package and leave them open; give the stock back so later specs (which count on 5) are not starved.
test.afterAll(async () => { await db.package.updateMany({where: {sku: 'SAMPLE_BASIC'}, data: {stockOnHand: 5}}); await db.$disconnect(); });

async function admin(browser: Browser) {
  const context = await browser.newContext();
  expect((await context.request.post('/api/auth/dev-admin')).ok()).toBe(true);
  return context;
}

async function ensureBankAccount(request: APIRequestContext) {
  const state = await (await request.get('/api/admin/settings/payments')).json();
  if (!state.accounts.some((account: {accountNumber: string; active: boolean}) => account.accountNumber === '0123456789' && account.active)) {
    expect((await request.post('/api/admin/settings/payments', {data: {action: 'save-account', bankBin: '970436', accountNumber: '0123456789', accountHolder: 'Nguyễn Văn Test', active: true}})).ok()).toBe(true);
  }
  expect((await request.post('/api/admin/settings/payments', {data: {action: 'rate', mode: 'fixed', vndPerUsd: 26000}})).ok()).toBe(true);
}

// A hand-made snapshot: the E2E never calls Hypixel.
const skill = (key: string, label: string, level: number, cap = 50) => ({key, label, level, cap, xpInto: 0, xpNext: null, totalXp: 0, maxed: level >= cap});
const stats = {
  version: 1, fetchedAt: new Date().toISOString(), source: 'manual', profile: {cuteName: 'Mango', gameMode: 'ironman', coop: false}, level: {level: 138, xp: 42, next: 100},
  skills: [skill('ALCHEMY', 'Alchemy', 20), skill('FARMING', 'Farming', 45), skill('MINING', 'Mining', 33, 60), skill('COMBAT', 'Combat', 30, 60)],
  summary: {joinedAt: null, purse: 162_900_000, bank: null, averageSkill: 30.3, fairySouls: {collected: 241, total: 289}, networth: 849_230_000, nonCosmeticNetworth: 801_100_000},
  gear: {inventoryApiOff: false, armor: {setName: 'Fermento Armor', bonus: [{stat: 'Farming Fortune', short: 'FrmFrt', value: 415}], items: [{name: 'Fermento Boots', rarity: 'EPIC', slot: 'Boots'}]}, equipment: null}
};

async function createAccount(request: APIRequestContext, over: Record<string, unknown> = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const response = await request.post('/api/admin/accounts', {data: {action: 'create', account: {ign: `Farmer${suffix}`, showIgn: false, title: `Farming 45 ${suffix}`, description: 'Hand-checked.', priceVnd: 520_000, stats, statsSource: 'manual', statsLocked: true, login: `Email: ${suffix}@mail.test\nPassword: Pa55-${suffix}`, status: 'available', ...over}}});
  expect(response.status(), await response.text()).toBe(201);
  return {...(await response.json()) as {id: string; code: string}, suffix};
}

const publicCatalog = async (request: APIRequestContext) => (await (await request.get('/api/catalog')).json()) as {accounts: {id: string; sku: string; stock: number; title: {en: string}; account: {ign: string | null; status: string}}[]};
const orderIdOf = async (code: string) => (await db.order.findUniqueOrThrow({where: {code}, select: {id: true}})).id;

test('SkyBlock accounts: stored encrypted, shown on the shelf without the IGN, bought without a time, delivered on payment', async ({browser}) => {
  test.setTimeout(240000);
  const adminContext = await admin(browser);
  await ensureBankAccount(adminContext.request);
  const account = await createAccount(adminContext.request);

  // The login is sealed in the database and never in a public answer.
  const stored = await db.gameAccount.findUniqueOrThrow({where: {id: account.id}});
  expect(stored.secretEnc).not.toContain('Pa55');
  expect(stored.status).toBe('available');
  const adminView = JSON.stringify((await (await adminContext.request.get(`/api/admin/accounts/${account.id}`)).json()));
  expect(adminView).not.toContain('Pa55');
  expect(adminView).not.toContain(stored.secretEnc);
  const line = (await publicCatalog(adminContext.request)).accounts.find(item => item.id === account.id)!;
  expect(line).toMatchObject({sku: account.code, stock: 1, account: {ign: null, status: 'available'}});
  expect(JSON.stringify(line)).not.toContain(stored.ign);
  const publicApi = JSON.stringify(await (await adminContext.request.get(`/api/accounts/${account.code}`)).json());
  expect(publicApi).not.toContain(stored.ign);
  expect(publicApi).not.toContain('Pa55');
  expect(publicApi).not.toContain('secretEnc');

  // The store: a second tab with the account; the page shows the skills and the summary.
  const buyerContext = await browser.newContext();
  await registerCustomer(buyerContext.request, 'Account Buyer');
  const page = await buyerContext.newPage();
  await page.goto('/en');
  await page.getByRole('tab', {name: /SkyBlock accounts/}).click();
  await expect(page).toHaveURL(/shelf=accounts/);
  const card = page.locator('.sb-card', {hasText: account.code});
  await expect(card).toBeVisible();
  await expect(card).toContainText('138');
  await expect(card).toContainText('Fermento Armor');
  await expect(card).not.toContainText(stored.ign);
  await card.getByRole('link', {name: /View account/}).click();
  await expect(page).toHaveURL(new RegExp(`/en/accounts/${account.code}$`));
  await expect(page.getByRole('heading', {name: 'Skills'})).toBeVisible();
  await expect(page.locator('.sb-skill', {hasText: 'Farming'})).toContainText('45');
  await expect(page.locator('.sb-summary')).toContainText('Average Skill Level');
  await expect(page.locator('.sb-summary')).toContainText('241 / 289');
  await expect(page.getByText('View on SkyCrypt')).toHaveCount(0);
  await page.screenshot({path: 'test-results/account-detail.png', fullPage: true});

  // Checkout for an account only has no "When" step, and the order needs no time.
  await page.getByRole('button', {name: 'Buy this account →'}).click();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.getByText('01 / WHEN')).toHaveCount(0);
  await expect(page.getByText('01 / PAYMENT METHOD')).toBeVisible();
  await expect(page.locator('.order-summary')).toContainText(stored.title);
  await page.getByRole('button', {name: 'Place order →'}).click();
  await expect(page).toHaveURL(/\/en\/orders\/JH[2-9A-Z]{6}$/);
  const code = page.url().split('/').pop()!;
  const orderId = await orderIdOf(code);
  const placed = await db.order.findUniqueOrThrow({where: {code}, select: {needsAppointment: true, status: true, items: {select: {kind: true, accountId: true, quantity: true, deliveredAt: true}}}});
  expect(placed).toMatchObject({needsAppointment: false, status: 'awaiting_payment'});
  expect(placed.items).toEqual([{kind: 'account', accountId: account.id, quantity: 1, deliveredAt: null}]);

  // While the order is open the account is reserved: nobody else can buy it, and the details stay hidden.
  expect((await db.gameAccount.findUniqueOrThrow({where: {id: account.id}})).status).toBe('reserved');
  const otherContext = await browser.newContext();
  await registerCustomer(otherContext.request, 'Late Buyer');
  const reservedLine = (await publicCatalog(otherContext.request)).accounts.find(item => item.id === account.id)!;
  expect(reservedLine).toMatchObject({stock: 0, account: {status: 'reserved'}});
  const refused = await otherContext.request.post('/api/orders', {data: {lines: [{productId: account.id, quantity: 1, delivery: {}}]}});
  expect(refused.status()).toBe(409);
  const otherPage = await otherContext.newPage();
  await otherPage.goto(`/en/accounts/${account.code}`);
  await expect(otherPage.getByRole('button', {name: 'Reserved'})).toBeDisabled();
  expect(JSON.stringify(await (await buyerContext.request.get(`/api/orders/${code}`)).json())).not.toContain('Pa55');
  // Asking for more than one unit is refused too.
  expect((await buyerContext.request.post('/api/orders', {data: {lines: [{productId: account.id, quantity: 2, delivery: {}}]}})).status()).toBe(409);

  // The customer says "paid" without choosing any time; the Admin confirms and the account is delivered at once.
  await db.order.update({where: {code}, data: {createdAt: new Date(Date.now() - 2 * 60_000)}});
  await page.reload();
  await page.getByRole('button', {name: 'I’ve transferred →'}).click();
  await expect(page.getByText('Thanks! We are confirming your payment').first()).toBeVisible();
  const confirmed = await adminContext.request.post(`/api/admin/orders/${orderId}`, {data: {action: 'confirm-payment', amountVnd: 520_000, reference: 'ACC-E2E'}});
  expect(confirmed.ok(), await confirmed.text()).toBe(true);

  const done = await db.order.findUniqueOrThrow({where: {code}, select: {status: true, completedAt: true, deliveryNote: true, items: {select: {deliveredAt: true, deliveredSecretEnc: true}}}});
  expect(done.status).toBe('completed');
  expect(done.completedAt).not.toBeNull();
  expect(done.items[0].deliveredAt).not.toBeNull();
  expect(done.items[0].deliveredSecretEnc).toBe(stored.secretEnc);
  expect(await db.gameAccount.findUniqueOrThrow({where: {id: account.id}, select: {status: true, soldAt: true}})).toMatchObject({status: 'sold'});

  // Only the buyer sees the details, and opening them is recorded once.
  await page.reload();
  const delivery = page.locator('.account-delivery');
  await expect(delivery).toContainText('YOUR SKYBLOCK ACCOUNT');
  await expect(delivery).toContainText(stored.ign);
  await expect(delivery.locator('.pay-row', {hasText: 'Password'})).toContainText(`Pa55-${account.suffix}`);
  await expect(delivery).toContainText('Change the password and recovery email right away');
  expect((await (await buyerContext.request.get(`/api/orders/${code}`)).json()).order.accounts[0]).toMatchObject({code: account.code, ign: stored.ign});
  expect(await db.orderEvent.count({where: {orderId, action: 'accounts_viewed'}})).toBe(1);
  expect((await otherContext.request.get(`/api/orders/${code}`)).status()).toBe(404);

  // The account is gone from the store; the Admin can open the delivered copy (recorded without the text).
  expect((await publicCatalog(otherContext.request)).accounts.some(item => item.id === account.id)).toBe(false);
  expect((await otherContext.request.get(`/api/accounts/${account.code}`)).status()).toBe(404);
  const itemId = (await db.orderItem.findFirstOrThrow({where: {orderId}, select: {id: true}})).id;
  const reveal = await adminContext.request.post(`/api/admin/orders/${orderId}`, {data: {action: 'reveal-account', itemId}});
  expect((await reveal.json()).login).toContain(`Pa55-${account.suffix}`);
  const audit = await db.auditLog.findMany({where: {action: 'account.secret_revealed', entityId: orderId}});
  expect(audit).toHaveLength(1);
  expect(JSON.stringify(audit)).not.toContain('Pa55');
  const later = await adminContext.request.post(`/api/admin/accounts/${account.id}`, {data: {action: 'set-status', status: 'available'}});
  expect(later.status()).toBe(409);
  // A sold account stays for the records.
  expect((await adminContext.request.delete('/api/admin/accounts', {data: {id: account.id}})).status()).toBe(409);

  await Promise.all([buyerContext.close(), otherContext.close(), adminContext.close()]);
});

test('SkyBlock accounts: a cancelled or expired order puts the account back on sale', async ({browser}) => {
  test.setTimeout(180000);
  const adminContext = await admin(browser);
  await ensureBankAccount(adminContext.request);
  const account = await createAccount(adminContext.request);
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Cancelling Buyer');
  const lines = [{productId: account.id, quantity: 1, delivery: {}}];

  const first = await customer.request.post('/api/orders', {data: {lines}});
  expect(first.status(), await first.text()).toBe(201);
  const firstCode = (await first.json()).code as string;
  expect((await db.gameAccount.findUniqueOrThrow({where: {id: account.id}})).status).toBe('reserved');
  expect((await customer.request.post(`/api/orders/${firstCode}`, {data: {action: 'cancel'}})).ok()).toBe(true);
  expect(await db.gameAccount.findUniqueOrThrow({where: {id: account.id}, select: {status: true, orderId: true, reservedAt: true}})).toEqual({status: 'available', orderId: null, reservedAt: null});

  // The hold runs out: the next time anyone looks at the order it expires and the account is released.
  const second = await customer.request.post('/api/orders', {data: {lines}});
  expect(second.status(), await second.text()).toBe(201);
  const secondCode = (await second.json()).code as string;
  await db.order.update({where: {code: secondCode}, data: {holdExpiresAt: new Date(Date.now() - 60_000)}});
  expect((await (await customer.request.get(`/api/orders/${secondCode}`)).json()).order.status).toBe('expired');
  expect((await db.gameAccount.findUniqueOrThrow({where: {id: account.id}})).status).toBe('available');
  expect((await publicCatalog(customer.request)).accounts.find(item => item.id === account.id)?.stock).toBe(1);

  // A late payment on the expired order only revives it while the account is still free; once it was sold to someone else it is refused.
  const rival = await customer.request.post('/api/orders', {data: {lines}});
  expect(rival.status(), await rival.text()).toBe(201);
  const secondId = await orderIdOf(secondCode);
  const late = await adminContext.request.post(`/api/admin/orders/${secondId}`, {data: {action: 'confirm-payment', amountVnd: 520_000, reference: 'LATE'}});
  expect(late.status()).toBe(409);
  expect((await late.json()).error).toContain('sold to another customer');
  expect(await db.order.findUniqueOrThrow({where: {code: secondCode}, select: {status: true}})).toEqual({status: 'expired'});
  await customer.request.post(`/api/orders/${(await rival.json()).code}`, {data: {action: 'cancel'}});
  await Promise.all([customer.close(), adminContext.close()]);
});

test('SkyBlock accounts: with a package in the same order the account is delivered at once and the package still needs a time', async ({browser}) => {
  test.setTimeout(180000);
  const adminContext = await admin(browser);
  await ensureBankAccount(adminContext.request);
  const account = await createAccount(adminContext.request, {showIgn: true});
  const customer = await browser.newContext();
  await registerCustomer(customer.request, 'Mixed Buyer');
  const packageId = await catalogId(customer.request, 'SAMPLE_BASIC');
  const start = new Date(Date.now() + 86_400_000);
  const timing = {timeZone: 'Asia/Ho_Chi_Minh', slots: [{start: start.toISOString(), end: new Date(start.getTime() + 3_600_000).toISOString()}]};
  const response = await customer.request.post('/api/orders', {data: {lines: [{productId: packageId, quantity: 1, delivery: {recipient: 'Mixed'}}, {productId: account.id, quantity: 1, delivery: {}}], timing}});
  expect(response.status(), await response.text()).toBe(201);
  const code = (await response.json()).code as string;
  const order = await db.order.findUniqueOrThrow({where: {code}, select: {id: true, needsAppointment: true, slots: true}});
  expect(order.needsAppointment).toBe(true);
  expect(order.slots).toHaveLength(1);
  expect((await adminContext.request.post(`/api/admin/orders/${order.id}`, {data: {action: 'confirm-payment', amountVnd: 780_000, reference: 'MIXED'}})).ok()).toBe(true);
  // Paid, not completed: the package still waits for its appointment, but the account is already on the order page.
  expect((await db.order.findUniqueOrThrow({where: {code}, select: {status: true}})).status).toBe('paid');
  const view = (await (await customer.request.get(`/api/orders/${code}`)).json()).order;
  expect(view.accounts).toHaveLength(1);
  expect(view.accounts[0].loginDetails).toContain('Password: Pa55-');
  expect((await db.gameAccount.findUniqueOrThrow({where: {id: account.id}})).status).toBe('sold');

  // Cancelling the rest of the order afterwards never puts the handed-over account back on sale.
  expect((await adminContext.request.post(`/api/admin/orders/${order.id}`, {data: {action: 'cancel', reason: 'Customer changed their mind'}})).ok()).toBe(true);
  const hidden = await db.gameAccount.findUniqueOrThrow({where: {id: account.id}, select: {status: true, adminNote: true}});
  expect(hidden.status).toBe('hidden');
  expect(hidden.adminNote).toContain('change the password before relisting');
  await Promise.all([customer.close(), adminContext.close()]);
});

test('SkyBlock accounts: Admin settings keep the Hypixel key secret and the form checks the status rules', async ({browser}) => {
  const adminContext = await admin(browser);
  const settings = '/api/admin/settings/accounts';
  const key = '069a79f4-44e9-4726-a5be-fca90e38aaf5';
  expect((await adminContext.request.post(settings, {data: {action: 'save-key', apiKey: 'not-a-key'}})).status()).toBe(400);
  const saved = await adminContext.request.post(settings, {data: {action: 'save-key', apiKey: key}});
  expect(saved.ok(), await saved.text()).toBe(true);
  const body = await saved.text();
  expect(body).not.toContain(key);
  expect(JSON.parse(body).hypixel).toMatchObject({hasKey: true, keyTail: 'aaf5'});
  expect(await (await adminContext.request.get(settings)).text()).not.toContain(key);
  expect((await db.storeSetting.findUniqueOrThrow({where: {key: 'hypixel'}})).value).not.toHaveProperty('apiKey');
  expect(JSON.stringify((await db.storeSetting.findUniqueOrThrow({where: {key: 'hypixel'}})).value)).not.toContain(key);
  expect((await adminContext.request.post(settings, {data: {action: 'remove-key'}})).ok()).toBe(true);
  expect((await (await adminContext.request.get(settings)).json()).hypixel.hasKey).toBe(false);
  // Without a key the lookup explains what to do instead of failing.
  const lookup = await adminContext.request.post('/api/admin/accounts', {data: {action: 'lookup', ign: 'Notch'}});
  expect(lookup.status()).toBe(409);

  const draft = await createAccount(adminContext.request, {status: 'draft'});
  expect((await adminContext.request.post(`/api/admin/accounts/${draft.id}`, {data: {action: 'set-status', status: 'available'}})).ok()).toBe(true);
  const noLogin = await adminContext.request.post('/api/admin/accounts', {data: {action: 'create', account: {ign: 'Nologin', showIgn: false, title: 'No login', priceVnd: 100_000, status: 'available'}}});
  expect(noLogin.status()).toBe(409);
  expect((await noLogin.json()).error).toContain('login details');
  const free = await adminContext.request.post('/api/admin/accounts', {data: {action: 'create', account: {ign: 'Nologin', showIgn: false, title: 'No price', priceVnd: 0, login: 'x', status: 'available'}}});
  expect(free.status()).toBe(409);
  // An account that was never in an order can be deleted.
  expect((await adminContext.request.delete('/api/admin/accounts', {data: {id: draft.id}})).ok()).toBe(true);
  await adminContext.close();
});

test('SkyBlock accounts: screenshots of the shelf and the account page at phone and desktop width', async ({browser}) => {
  test.setTimeout(180000);
  const adminContext = await admin(browser);
  const account = await createAccount(adminContext.request, {title: 'Farming 45 · Fermento Armor · 849M NW'});
  for (const [name, width, height] of [['mobile', 360, 800], ['desktop', 1280, 900]] as const) {
    const context = await browser.newContext({viewport: {width, height}, isMobile: width < 500, hasTouch: width < 500});
    const page = await context.newPage();
    await page.goto('/en?shelf=accounts');
    await expect(page.locator('.sb-card', {hasText: account.code})).toBeVisible();
    // Nothing may run off the side of the screen.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('#catalog').screenshot({path: `test-results/accounts-shelf-${name}.png`});
    await page.goto(`/en/accounts/${account.code}`);
    await expect(page.getByRole('heading', {name: 'Skills'})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/account-page-${name}.png`, fullPage: true});
    await context.close();
  }
  await adminContext.request.post(`/api/admin/accounts/${account.id}`, {data: {action: 'set-status', status: 'hidden'}});
  await adminContext.close();
});
