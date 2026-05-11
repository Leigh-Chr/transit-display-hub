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

  test('SVG element is present in the DOM', async ({ page }) => {
    const mapPage = new NetworkMapPage(page);
    await mapPage.goto();
    // Allow up to 10 s for the network data to load and the SVG to render
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10_000 });
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
