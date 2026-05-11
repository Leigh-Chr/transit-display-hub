import { test, expect } from '@playwright/test';
import { NetworkMapPage } from './pages/NetworkMapPage';
import { NetworkListPage } from './pages/NetworkListPage';

/**
 * Network map tests — schematic page, accessible list alternative.
 * These are public routes; no authentication required.
 */
test.describe('Network map', () => {
  test('renders the schematic page with a heading', async ({ page }) => {
    const mapPage = new NetworkMapPage(page);
    await mapPage.goto();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('renders either the schematic SVG or the line-index fallback', async ({ page }) => {
    const mapPage = new NetworkMapPage(page);
    await mapPage.goto();
    // The map auto-switches between schematic and line-index views depending
    // on how many lines are simultaneously visible (default behaviour for
    // feeds with many routes). Either view counts as "the page rendered".
    const schematic = page.locator('app-schematic-map svg').first();
    const lineIndex = page.locator('app-line-index').first();
    await expect(schematic.or(lineIndex)).toBeVisible({ timeout: 10_000 });
  });

  test('accessible list link navigates to /map/list', async ({ page }) => {
    const mapPage = new NetworkMapPage(page);
    await mapPage.goto();
    await mapPage.goToList();
    await expect(page).toHaveURL(/\/map\/list$/);
  });

  test('list page renders directly with a heading', async ({ page }) => {
    const listPage = new NetworkListPage(page);
    await listPage.goto();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('list page renders stop rows when feed data is available', async ({ page }) => {
    const listPage = new NetworkListPage(page);
    await listPage.goto();

    // Wait for the loading indicator to disappear
    await page.waitForSelector('[role="status"]', { state: 'hidden', timeout: 10_000 }).catch(() => {
      // Not present when data loads fast — that's fine
    });

    // Either we have rows, or we have an empty-state element — both are valid.
    const rowCount = await listPage.getRowCount();
    const hasEmptyState = await page.locator('app-empty-state, .empty-state').count();
    expect(rowCount > 0 || hasEmptyState > 0).toBe(true);
  });
});
