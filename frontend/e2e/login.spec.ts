import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

/**
 * Login page tests — form rendering, keyboard navigation, and the
 * actual sign-in flow (requires a running backend with default users).
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
    await loginPage.login('admin', 'admin123');
    await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
  });

  test('wrong credentials show inline error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('admin', 'wrong-password');

    const errorText = await loginPage.getErrorMessage();
    expect(errorText).toMatch(/invalid|incorrect|credentials|identifiants/i);
  });
});
