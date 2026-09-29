import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: {baseURL: 'http://127.0.0.1:3001', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined)},
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3001',
    url: 'http://127.0.0.1:3001/en',
    env: {DATABASE_URL: '', ALLOW_DEV_ADMIN_LOGIN: '1', NEXT_BUILD_DIR: '.next-e2e'},
    reuseExistingServer: false,
    timeout: 120000
  }
});
