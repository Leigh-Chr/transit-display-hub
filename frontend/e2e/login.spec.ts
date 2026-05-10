import { test, expect } from '@playwright/test';

/**
 * Auth-page smoke test. Checks that the login form renders and the
 * username + password inputs are focusable from the keyboard. The
 * actual sign-in flow needs a running backend with default users
 * loaded; we leave it out of the smoke suite so the test passes
 * when the API is unavailable.
 */
test('login page renders and is keyboard-navigable', async ({ page }) => {
  await page.goto('/login');
  const usernameInput = page.getByLabel(/utilisateur|username/i);
  const passwordInput = page.getByLabel(/mot de passe|password/i);
  await expect(usernameInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await usernameInput.focus();
  await page.keyboard.press('Tab');
  await expect(passwordInput).toBeFocused();
});
