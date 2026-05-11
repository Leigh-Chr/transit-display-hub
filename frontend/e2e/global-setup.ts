import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';

/**
 * Runs once before the entire Playwright suite. Logs in as admin,
 * then persists the browser storage state (cookies + localStorage)
 * to {@code e2e/.auth/admin.json} so individual tests can reuse the
 * session without re-authenticating on every spec.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:4200/login');
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 30_000 });

  mkdirSync('e2e/.auth', { recursive: true });
  await page.context().storageState({ path: 'e2e/.auth/admin.json' });

  await browser.close();
}

export default globalSetup;
