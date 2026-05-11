import { test, expect } from '@playwright/test';
import { NetworkListPage } from './pages/NetworkListPage';

/**
 * Dedicated spec for the tabular alternative at {@code /map/list}.
 * Previously untested; these assertions cover the component-level
 * rendering regardless of whether feed data is present.
 */
test.describe('Network list (/map/list)', () => {
  test('page title is visible', async ({ page }) => {
    const listPage = new NetworkListPage(page);
    await listPage.goto();
    await expect(page.locator('h1')).toBeVisible();
  });

  test('back-to-map link is present and correct', async ({ page }) => {
    const listPage = new NetworkListPage(page);
    await listPage.goto();
    const backLink = page.getByRole('link', { name: /map|carte/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', /\/map$/);
  });

  test('search input is present and accepts text', async ({ page }) => {
    const listPage = new NetworkListPage(page);
    await listPage.goto();
    const searchInput = page.locator('input[type="search"], input[matInput]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
    // No assertion on results — just confirm the input is interactive
    await expect(searchInput).toHaveValue('test');
  });

  test('accessible-only and on-demand checkboxes are present', async ({ page }) => {
    const listPage = new NetworkListPage(page);
    await listPage.goto();
    const checkboxes = page.locator('mat-checkbox');
    await expect(checkboxes).toHaveCount(2);
  });
});
