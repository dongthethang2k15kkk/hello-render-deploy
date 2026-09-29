import assert from 'node:assert/strict';

const base = process.env.SMOKE_URL || 'http://localhost:3000';
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(base + '/api/health');
    if (response.ok) {
      assert.deepEqual(await response.json(), {status: 'ok'});
      ready = true;
      break;
    }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(ready, 'Container did not become healthy');
for (const path of ['/vi', '/en', '/en/login']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const asset = html.match(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/)?.[1];
  assert.ok(asset, 'Missing static asset on ' + path);
  assert.equal((await fetch(new URL(asset.replaceAll('&amp;', '&'), base))).status, 200);
}
assert.equal((await fetch(base + '/api/admin/products')).status, 403);
assert.equal((await fetch(base + '/api/admin/orders')).status, 403);
// Admin signs in with Google only; a registered customer proves database-backed accounts work.
const register = await fetch(base + '/api/auth/register', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({email: `smoke-${Date.now()}@example.test`, name: 'Smoke Test', password: 'smoke-password-123'})
});
if (process.env.SMOKE_WITHOUT_DB === '1') {
  assert.equal(register.status, 503);
} else {
  assert.equal(register.status, 200, await register.text());
  const cookie = register.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('shop_session='), 'Missing customer session cookie');
  const session = await (await fetch(base + '/api/auth/session', {headers: {cookie}})).json();
  assert.equal(session.account?.role, 'user');
  assert.equal((await fetch(base + '/api/admin/products', {headers: {cookie}})).status, 403);
  assert.equal((await fetch(base + '/api/admin/customers', {headers: {cookie}})).status, 403);
  assert.equal((await fetch(base + '/api/chat', {headers: {cookie}})).status, 200);
}
console.log('Container smoke checks passed.');