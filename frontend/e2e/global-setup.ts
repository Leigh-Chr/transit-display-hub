import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';

/**
 * Rotation password installed by the global setup the first time the
 * suite runs against a fresh DB (Flyway V52 ships the admin row with
 * {@code password_must_change = TRUE}). Twelve characters minimum to
 * satisfy the backend {@code @Size(min = 12)} constraint. Exported so
 * specs that re-login outside the persisted storage state know which
 * password to use after the first run.
 */
export const ADMIN_ROTATED_PASSWORD = 'admin123-rotated';

/**
 * Runs once before the entire Playwright suite. Logs in as admin,
 * traverses the forced password rotation if Flyway V52 flagged the
 * seeded admin, then persists the browser storage state (cookies +
 * localStorage) to {@code e2e/.auth/admin.json} so individual tests can
 * reuse the session without re-authenticating on every spec.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Try the initial credentials first; if the previous run already
  // rotated the password we fall back to the post-rotation value below.
  await page.goto('http://localhost:4200/login');
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.locator('button[type="submit"]').click();

  try {
    await page.waitForURL(/\/(auth\/change-password|admin)(\/|$)/, { timeout: 30_000 });
  } catch {
    // admin123 was rejected — DB has already been rotated by a previous
    // run. Replay the login with the rotated password.
    await page.goto('http://localhost:4200/login');
    await page.locator('input[name="username"]').fill('admin');
    await page.locator('input[type="password"]').fill(ADMIN_ROTATED_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin(\/|$)/, { timeout: 30_000 });
  }

  if (page.url().includes('/auth/change-password')) {
    await page.locator('input[name="currentPassword"]').fill('admin123');
    await page.locator('input[name="newPassword"]').fill(ADMIN_ROTATED_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(ADMIN_ROTATED_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin(\/|$)/, { timeout: 30_000 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Node's fs module isn't typed under the strict project tsconfig used to lint e2e; the call is plain and safe.
  mkdirSync('e2e/.auth', { recursive: true });
  await page.context().storageState({ path: 'e2e/.auth/admin.json' });

  await browser.close();
}

export default globalSetup;
