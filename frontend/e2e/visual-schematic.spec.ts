import { test, expect } from '@playwright/test';

/**
 * Visual regression test for the network schematic.
 *
 * {@link expect(page).toHaveScreenshot()} saves a baseline on the
 * first run and diffs against it on subsequent runs. The
 * {@code maxDiffPixels: 100} tolerance (configured in
 * {@code playwright.config.ts}) absorbs minor font-rendering
 * differences across platforms.
 *
 * This test only runs in the Chromium project to keep baselines
 * consistent. Add {@code --project=chromium} when updating snapshots:
 *   npx playwright test visual-schematic --update-snapshots --project=chromium
 */
test.describe('Visual regression — network schematic', () => {
  test('schematic at default zoom matches baseline @chromium', async ({ page, browserName }) => {
    // Restrict to Chromium for deterministic font rendering
    test.skip(browserName !== 'chromium', 'Visual baseline is Chromium-only');

    await page.goto('/map');

    // Wait for the SVG to be present and stable (data loaded)
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 15_000 });

    // Give animations / transitions a moment to settle
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('schematic-default-zoom.png', {
      fullPage: false,
      // Clip to the map area to exclude the header which may carry a live clock
      clip: { x: 0, y: 80, width: 1280, height: 800 },
    });
  });
});
