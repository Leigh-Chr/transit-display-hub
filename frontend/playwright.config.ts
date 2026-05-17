import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * - Three browser projects: Chromium, Firefox, Mobile Chrome.
 * - Single global-setup run that logs in and persists storage state so
 *   auth fixtures can reuse the session without re-authenticating.
 * - Visual regression tolerance of 100 px to absorb font-rendering
 *   differences between platforms and CI runners.
 * - {@code webServer.timeout} raised to 300 s to accommodate Angular's
 *   cold-start compilation on the first CI run.
 *
 * In CI, set {@code E2E_BACKEND_RUNNING=1} once Spring Boot is up so
 * Playwright skips its own webServer for the backend and only spawns
 * {@code ng serve}. Locally, run the backend yourself and let Playwright
 * spin the dev server.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
  fullyParallel: true,
  // CI runners hit transient timing flakiness on the slow first cold-start
  // (Angular dev server warm-up + Spring Boot context load). Two retries
  // absorb most of those without masking a genuinely broken spec.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: './e2e/global-setup',
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
    timeout: 300_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
