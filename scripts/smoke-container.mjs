import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

async function* events(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, {stream: true});
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').find(line => line.startsWith('data: '));
        if (data) yield JSON.parse(data.slice(6));
      }
    }
  } finally {await reader.cancel().catch(() => {});}
}

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
  // Proves the POST and streaming route share the bus in the standalone production bundle.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let stream;
  try {
    const response = await fetch(base + '/api/chat/events', {headers: {cookie}, signal: controller.signal});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    stream = events(response.body);
    await stream.next(); // ready, after the server subscription is installed
    const notification = stream.next();
    const body = JSON.stringify({body: 'Container chat delivery check', clientMessageId: randomUUID()});
    const send = () => fetch(base + '/api/chat', {method: 'POST', headers: {cookie, 'content-type': 'application/json'}, body});
    const started = performance.now();
    const sent = await send();
    assert.equal(sent.status, 200, await sent.clone().text());
    const receipt = await sent.json();
    const event = (await notification).value;
    assert.equal(event.message.id, receipt.message.id);
    assert.equal(event.room, `user:${session.account.id}`);
    console.log(`Standalone chat receipt + event: ${Math.round(performance.now() - started)} ms`);
    const retry = await send();
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).message.id, receipt.message.id);
  } finally {clearTimeout(timeout); controller.abort(); await stream?.return().catch(() => {});}
}
console.log('Container smoke checks passed.');
