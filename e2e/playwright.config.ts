// End-to-end tests — frontend-spec §11. Starts the API (wrangler dev, fake providers, log-only
// email) against a dedicated database and the web dev server, then drives real browsers.
import { defineConfig, devices } from '@playwright/test';

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://trip:trip@localhost:5432/tripplanner_e2e';
const pnpm = process.env.CI ? 'pnpm' : 'corepack pnpm';

export default defineConfig({
  testDir: './tests',
  globalSetup: './globalSetup.ts',
  // Tests share one database; run them one at a time for predictable presence/polling.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command:
        `${pnpm} --filter @tripplanner/api exec wrangler dev --port 8787` +
        ` --var DATABASE_URL:${E2E_DATABASE_URL}` +
        ` --var EMAIL_HMAC_SECRET:e2e-hmac-secret-e2e-hmac-secret-e2e-hmac` +
        ` --var GEOAPIFY_API_KEY:unused --var RESEND_API_KEY:unused` +
        ` --var ENVIRONMENT:development --var PROVIDER_MODE:fake --var EMAIL_MODE:log`,
      // openapi.json needs no database, so this works before globalSetup has created it.
      url: 'http://127.0.0.1:8787/api/v1/openapi.json',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `${pnpm} --filter @tripplanner/web dev --port 5173 --strictPort`,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
