import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/image-object2',
  testMatch: '*.e2e.spec.js',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5180',
    headless: true
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5180',
    url: 'http://127.0.0.1:5180',
    timeout: 120000,
    reuseExistingServer: true
  }
});
