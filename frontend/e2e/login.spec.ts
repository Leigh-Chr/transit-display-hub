import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ADMIN_ROTATED_PASSWORD } from './global-setup';

/**
 * Login page tests — form rendering, keyboard navigation, and the
 * actual sign-in flow (requires a running backend with default users).
 *
 * Global setup already rotated the admin password from {@code admin123}
 * to {@link ADMIN_ROTATED_PASSWORD} when the DB still carried the
 * V52 must-change flag, so the redirect specs below land on /admin
 * directly without going through {@code /auth/change-password}.
 */
test.describe('Login', () => {
  test('renders and is keyboard-navigable', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();

    await loginPage.usernameInput.focus();
    await page.keyboard.press('Tab');
    await expect(loginPage.passwordInput).toBeFocused();
  });

  test('admin credentials redirect to /admin', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('admin', ADMIN_ROTATED_PASSWORD);
    await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
  });

  test('wrong credentials show inline error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('admin', 'wrong-password');

    const errorText = await loginPage.getErrorMessage();
    // Accept the rate-limited variant too: parallel test runs share the
    // per-IP Bucket4j bucket, so the 6th wrong attempt within the window
    // returns 429 and the form surfaces a "too many attempts" message.
    expect(errorText).toMatch(/invalid|incorrect|credentials|identifiants|too many/i);
  });

  test('change-password screen renders for an authenticated admin', async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    try {
      await page.goto('/auth/change-password');
      await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
      await expect(page.locator('input[name="newPassword"]')).toBeVisible();
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
