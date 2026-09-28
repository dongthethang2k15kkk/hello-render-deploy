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
assert.equal((await fetch(base + '/api/payment-admin')).status, 401);
const login = await fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({username: 'admin', password: 'admin123'})
});
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie, 'Missing session cookie');
const products = await fetch(base + '/api/admin/products', {headers: {cookie}});
if (process.env.SMOKE_WITHOUT_DB === '1') {
  assert.equal(products.status, 503);
} else {
  assert.equal(products.status, 200);
  assert.ok(Array.isArray((await products.json()).products));
}
console.log('Container smoke checks passed.');