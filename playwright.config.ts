import {defineConfig} from '@playwright/test';

// Local runs read E2E_DATABASE_URL from .env; CI passes it directly.
try { process.loadEnvFile('.env'); } catch { /* no local .env */ }

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  // Locally the E2E database is a remote Neon branch (80-300 ms per query from Vietnam) behind a dev server that compiles on demand,
  // so multi-step flows need more than the defaults. CI uses a local PostgreSQL service and finishes far below these limits.
  timeout: 60000,
  expect: {timeout: 15000},
  globalSetup: './tests/e2e/global-setup.ts',
  use: {baseURL: 'http://127.0.0.1:3001', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined)},
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3001',
    url: 'http://127.0.0.1:3001/en',
    // Exchange rates come from the fixed numbers only, so prices are the same on every run.
    env: {DATABASE_URL: process.env.E2E_DATABASE_URL ?? '', ALLOW_DEV_ADMIN_LOGIN: '1', NEXT_BUILD_DIR: '.next-e2e', EXCHANGE_RATES_OFFLINE: '1'},
    reuseExistingServer: false,
    timeout: 120000
  }
});
