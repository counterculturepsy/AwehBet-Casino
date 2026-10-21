const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
 testDir: './e2e',
 timeout: 30000,
 expect: { timeout: 10000 },
 retries: 0,
 workers: 1,
 reporter: 'list',
 use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium', headless: true, trace: 'retain-on-failure' },
 webServer: {
  command: 'pnpm --filter @awehbet/web start --hostname 127.0.0.1 --port 3000',
  url: 'http://127.0.0.1:3000/slots',
  reuseExistingServer: false,
  timeout: 120000,
 },
});
