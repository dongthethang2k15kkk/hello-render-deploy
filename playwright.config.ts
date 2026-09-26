import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: {baseURL: 'http://127.0.0.1:3001', channel: process.env.PLAYWRIGHT_CHANNEL || undefined},
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3001',
    url: 'http://127.0.0.1:3001/vi',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});