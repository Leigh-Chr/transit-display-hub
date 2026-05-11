import { test, expect } from './fixtures/auth.fixture';
import { test as plainTest } from '@playwright/test';

/**
 * Role-based access control tests.
 *
 * The {@code roleGuard} in app.routes.ts redirects non-ADMIN users
 * away from guarded routes (e.g. /admin/users) to /admin/dashboard
 * instead of returning HTTP 403 — the Angular SPA handles this
 * client-side.
 *
 * For the admin user (fixture), all routes must be reachable.
 * For an agent-role user the guarded routes redirect to /admin/dashboard.
 */
test.describe('Role gating', () => {
  test('admin can access /admin/users', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.waitForSelector('h1', { timeout: 10_000 });
    // Must stay on the users page, not be redirected
    await expect(adminPage).toHaveURL(/\/admin\/users/);
  });

  test('admin can access /admin/lines', async ({ adminPage }) => {
    await adminPage.goto('/admin/lines');
    await adminPage.waitForSelector('h1', { timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/admin\/lines/);
  });

  test.skip('agent-role user is redirected away from /admin/users', async () => {
    /*
     * To unblock this test:
     *   1. Create a user with role=AGENT via the API in a beforeAll hook.
     *   2. Log in as that user to obtain a separate storage state.
     *   3. Navigate to /admin/users.
     *   4. Assert the URL becomes /admin/dashboard (roleGuard redirect).
     *
     * Blocked because the test suite does not currently create a second
     * user with a known password in the seed data.
     */
  });

  plainTest('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
