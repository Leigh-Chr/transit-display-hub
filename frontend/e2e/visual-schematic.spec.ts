import { test, expect } from '@playwright/test';
import { waitForAnimationsToSettle } from './fixtures/wait-for-stable';

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

    // The network-map auto-switches to a line-index view when more than
    // 30 lines are simultaneously visible. The baseline is only valid
    // for the schematic mode, so skip the visual check entirely when
    // the current feed pushes us into the index view.
    const schematic = page.locator('app-schematic-map svg').first();
    const lineIndex = page.locator('app-line-index').first();
    await Promise.race([
      schematic.waitFor({ timeout: 8_000 }).catch(() => undefined),
      lineIndex.waitFor({ timeout: 8_000 }).catch(() => undefined),
    ]);
    if (await lineIndex.isVisible().catch(() => false)) {
      test.skip(true, 'Active feed has >30 lines — schematic mode is off, baseline does not apply.');
      return;
    }

    // Wait for fade-ins and SVG transitions to settle instead of a
    // hand-tuned sleep; infinite animations (none on this view today)
    // are ignored by the helper.
    await waitForAnimationsToSettle(page);

    await expect(page).toHaveScreenshot('schematic-default-zoom.png', {
      fullPage: false,
      // Clip to the map area to exclude the header which may carry a live clock
      clip: { x: 0, y: 80, width: 1280, height: 800 },
      // The schematic layout depends on live GTFS data and the layout
      // algorithm has non-deterministic tiebreakers — absorb up to 5 %
      // of pixel diff for legitimate per-import shifts in stop positions
      // while still catching wholesale rendering regressions. Override
      // the strict 100 px config default explicitly so the ratio is the
      // sole gate here.
      maxDiffPixels: Number.MAX_SAFE_INTEGER,
      maxDiffPixelRatio: 0.05,
    });
  });
});
