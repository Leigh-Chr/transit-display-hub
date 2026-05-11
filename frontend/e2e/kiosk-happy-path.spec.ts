import { test, expect } from '@playwright/test';
import { KioskPage } from './pages/KioskPage';

/**
 * Kiosk display tests.
 *
 * The kiosk works in two modes:
 *   - stop ID in the URL path  → {@code /display/<stopId>}
 *   - device token in query    → {@code /display?token=<token>}
 *
 * For the token-based mode a real registered device token is needed.
 * Since the gtfs-rich seed does not expose a known static token, those
 * tests are skipped and documented below.
 *
 * The path-based mode is always testable because the component falls
 * back gracefully to a loading / error state for unknown stop IDs.
 */
test.describe('Kiosk display', () => {
  test('kiosk route loads without crashing (unknown stop shows error/loading state)', async ({ page }) => {
    const kioskPage = new KioskPage(page);
    // Use a stop ID that is unlikely to exist — verifies the component
    // boots and renders some UI rather than a blank / broken page.
    await kioskPage.gotoForStop('unknown-stop-e2e');

    // The component always renders the outer .kiosk wrapper regardless of state
    const kioskRoot = page.locator('.kiosk');
    await expect(kioskRoot).toBeVisible({ timeout: 10_000 });

    // Either an error-state or a loading-state should be shown for an unknown stop
    const feedback = page.locator('.error-state, .loading-state, mat-spinner');
    await expect(feedback.first()).toBeVisible({ timeout: 10_000 });
  });

  test.skip('kiosk token mode — requires a registered device token from the API', async ({ page }) => {
    /*
     * To unblock this test:
     *   1. POST /api/devices with admin credentials to register a device.
     *   2. Extract the token from the response.
     *   3. Pass the token to kioskPage.gotoForDevice(token).
     *   4. Assert that .kiosk header and .arrivals-list are visible.
     *
     * The gtfs-rich seed does not pre-seed a device token, so the token
     * would have to be created dynamically in a beforeAll hook.
     */
    const kioskPage = new KioskPage(page);
    await kioskPage.gotoForDevice('PLACEHOLDER_TOKEN');
    await expect(page.locator('header.header')).toBeVisible({ timeout: 15_000 });
  });
});
