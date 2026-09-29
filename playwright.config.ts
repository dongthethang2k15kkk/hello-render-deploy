import {defineConfig} from '@playwright/test';

// Local runs read E2E_DATABASE_URL from .env; CI passes it directly.
try { process.loadEnvFile('.env'); } catch { /* no local .env */ }

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  // Locally the E2E database is a remote Neon branch and the dev server compiles on demand; 5 s is too tight for sign-in round trips.
  expect: {timeout: 10000},
  globalSetup: './tests/e2e/global-setup.ts',
  use: {baseURL: 'http://127.0.0.1:3001', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined)},
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3001',
    url: 'http://127.0.0.1:3001/en',
    env: {DATABASE_URL: process.env.E2E_DATABASE_URL ?? '', ALLOW_DEV_ADMIN_LOGIN: '1', NEXT_BUILD_DIR: '.next-e2e'},
    reuseExistingServer: false,
    timeout: 120000
  }
});
