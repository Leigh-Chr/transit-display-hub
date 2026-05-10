import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal Playwright config: a single browser project (Chromium),
 * tests under {@code e2e/}, screenshots and traces only on failure.
 * The {@code webServer} block is intentionally absent — kicking up
 * Spring Boot from inside Playwright would compound startup latency.
 * Run the backend yourself before {@code npm run e2e}, or skip the
 * suite when the API isn't reachable (it's tagged separately from
 * the unit tests that the pre-push hook runs).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
