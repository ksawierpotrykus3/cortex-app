import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev:renderer',
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: true,
  },
});
