import { test, expect } from './fixtures/auth.fixture';

/**
 * GTFS import audit page tests.
 *
 * The import-audit page lists past import attempts. The reimport
 * trigger lives in a different section of the admin (GTFS-data or a
 * dedicated button). These tests check that the audit page renders and
 * that the refresh action is available.
 *
 * A full reimport E2E (click → 202 → new audit row) is skipped because
 * it depends on a reachable GTFS feed URL that is not available in the
 * standard dev / CI environment.
 */
test.describe('Admin — Import audit', () => {
  test('import-audit page renders with the refresh button', async ({ adminPage }) => {
    await adminPage.goto('/admin/import-audit');
    await adminPage.waitForSelector('h1');

    const refreshBtn = adminPage.getByRole('button', { name: /refresh|actualiser/i });
    await expect(refreshBtn).toBeVisible();
  });

  test('audit list or empty-state is shown', async ({ adminPage }) => {
    await adminPage.goto('/admin/import-audit');
    await adminPage.waitForSelector('h1');

    // Either we have a table or an empty-state component — both are valid
    const hasTable = await adminPage.locator('table.audit-table').count();
    const hasEmpty = await adminPage.locator('app-empty-state').count();
    expect(hasTable + hasEmpty).toBeGreaterThan(0);
  });

  test.skip('reimport button triggers 202 and creates a new audit row', async ({ adminPage: _adminPage }) => {
    /*
     * To unblock this test:
     *   1. Navigate to /admin/import-audit or the dedicated trigger page.
     *   2. Intercept the POST to /api/gtfs/import and assert the response is 202.
     *   3. Wait for the audit table to gain a new row.
     *
     * Requires a reachable GTFS feed URL configured in the backend .env,
     * which is not guaranteed in the base CI environment.
     */
  });
});
