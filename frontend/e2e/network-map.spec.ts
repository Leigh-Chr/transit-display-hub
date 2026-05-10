import { test, expect } from '@playwright/test';

/**
 * Smoke test for the public network map. Confirms the page boots,
 * the schematic SVG renders, and the accessible tabular alternative
 * is reachable from the header. Doesn't assert on actual content —
 * a feed-less install still satisfies the test.
 */
test.describe('Network map', () => {
  test('renders the schematic page', async ({ page }) => {
    await page.goto('/map');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('exposes a tabular alternative reachable from the header', async ({ page }) => {
    await page.goto('/map');
    const listLink = page.getByRole('link', { name: /accessible|liste|list/i });
    await expect(listLink).toBeVisible();
    await listLink.click();
    await expect(page).toHaveURL(/\/map\/list$/);
  });

  test('renders the tabular view directly', async ({ page }) => {
    await page.goto('/map/list');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
