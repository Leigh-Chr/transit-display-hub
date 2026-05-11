import { test, expect } from '@playwright/test';
import { HubPage } from './pages/HubPage';

/**
 * Hub display tests (multi-stop aggregated board at {@code /hub}).
 *
 * Like the kiosk, the hub identifies its context via a device token
 * query parameter. Without a pre-seeded token the hub renders a
 * loading / error state — which is still a valid render target to test.
 *
 * Tests requiring a real hub device token are skipped and documented.
 */
test.describe('Hub display', () => {
  test('hub route loads without crashing (no token shows graceful state)', async ({ page }) => {
    const hubPage = new HubPage(page);
    await hubPage.goto();

    // The outer .kiosk wrapper is always rendered
    const hubRoot = page.locator('.kiosk');
    await expect(hubRoot).toBeVisible({ timeout: 10_000 });
  });

  test.skip('hub token mode — requires a registered hub device token', async ({ page }) => {
    /*
     * To unblock this test:
     *   1. POST /api/devices with type=HUB and admin credentials.
     *   2. Extract the token from the response.
     *   3. Pass the token to hubPage.gotoForDevice(token).
     *   4. Assert hubState header (hub name) and per-stop panels.
     *
     * The gtfs-rich seed does not pre-seed a HUB device token.
     */
    const hubPage = new HubPage(page);
    await hubPage.gotoForDevice('PLACEHOLDER_HUB_TOKEN');
    await expect(page.locator('header.header h1')).toBeVisible({ timeout: 15_000 });
  });
});
