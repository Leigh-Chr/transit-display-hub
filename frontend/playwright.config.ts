import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal Playwright config: a single browser project (Chromium),
 * tests under {@code e2e/}, screenshots and traces only on failure.
 *
 * In CI, set {@code E2E_BACKEND_RUNNING=1} once Spring Boot is up so
 * Playwright skips its own webServer for the backend and only spawns
 * {@code ng serve}. Locally, run the backend yourself and let Playwright
 * spin the dev server.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_NO_WEBSERVER === '1' ? undefined : {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
