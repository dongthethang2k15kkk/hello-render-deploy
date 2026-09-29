import {execFileSync} from 'node:child_process';

/**
 * Prepares the dedicated E2E database without deleting anything: applies migrations and upserts
 * the demo catalog. Tests create their own uniquely named customers, so data from earlier runs is
 * harmless. The database must start without other products (a fresh CI service or a Neon
 * schema-only branch). Never touches DATABASE_URL.
 */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error('Set E2E_DATABASE_URL to a disposable PostgreSQL database (see DATABASE.md).');
  if (process.env.DATABASE_URL && new URL(url).host === new URL(process.env.DATABASE_URL).host) {
    throw new Error('E2E_DATABASE_URL points at the same database host as DATABASE_URL; refusing to use it for tests.');
  }
  const env = {...process.env, DATABASE_URL: url};
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {env, stdio: 'inherit'});
  execFileSync(process.execPath, ['scripts/seed-demo-catalog.mjs', '--confirm-demo'], {env, stdio: 'inherit'});
  await warmUp();
}

// The dev server compiles each route on first request; compile them once so tests measure behaviour, not compilation.
async function warmUp(base = 'http://127.0.0.1:3001') {
  const routes = ['/en', '/en/login', '/en/workspace', '/en/account', '/en/cart', '/en/checkout', '/en/forgot-password', '/en/privacy', '/en/admin/customers', '/en/admin/chat', '/en/admin/settings/products',
    '/en/orders', '/en/inbox', '/en/admin/overview', '/en/admin/orders', '/en/admin/activity', '/en/admin/settings/payments', '/en/admin/settings/email',
    '/api/auth/session', '/api/auth/providers', '/api/catalog', '/api/chat', '/api/account', '/api/admin/customers', '/api/admin/login-events', '/api/auth/register', '/api/auth/login',
    '/api/orders', '/api/notifications', '/api/admin/orders', '/api/admin/overview', '/api/admin/activity', '/api/admin/settings/payments', '/api/admin/email'];
  try { await fetch(`${base}/api/health`); } catch { console.log('[e2e] dev server not running yet; skipping route warm-up'); return; }
  const started = Date.now();
  for (const route of routes) await fetch(base + route, {redirect: 'manual'}).catch(() => undefined);
  console.log(`[e2e] warmed ${routes.length} routes in ${Math.round((Date.now() - started) / 1000)} s`);
}
