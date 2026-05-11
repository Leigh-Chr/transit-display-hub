import { test, expect } from './fixtures/auth.fixture';
import { AdminLinesPage } from './pages/AdminLinesPage';

/**
 * CRUD flow on the Lines admin page.
 *
 * Uses the {@code adminPage} fixture (pre-authenticated via storage
 * state) to skip the login step on every test.
 */
test.describe('Admin — Lines CRUD', () => {
  // Admin is desktop-only by design — the side-drawer overlay on mobile
  // intercepts pointer events on the form actions. The functional
  // coverage on Chromium / Firefox is enough; mobile-chrome runs only
  // public-facing flows (kiosk, hub, network map).
  test.skip(({ browserName, isMobile }) => browserName === 'chromium' && isMobile === true,
    'Admin UI is desktop-only');
  // Unique code that also sorts to the top of the list (default sort is by
  // code ASC) so the newly-created card is visible on page 1 without
  // paginating.
  const CODE = `0E${Date.now() % 100000}`;
  const NAME = 'E2E Test Line';

  test('create → snackbar → line appears in list', async ({ adminPage }) => {
    const linesPage = new AdminLinesPage(adminPage);
    await linesPage.goto();

    await linesPage.createLine(CODE, NAME, 'BUS');

    const snackText = await linesPage.getSnackbarText();
    expect(snackText).toBeTruthy();

    // The newly-created card should be visible
    const card = adminPage.locator('.line-card', {
      has: adminPage.locator('.line-code', { hasText: CODE }),
    });
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test('edit line opens dialog with existing data', async ({ adminPage }) => {
    const linesPage = new AdminLinesPage(adminPage);
    await linesPage.goto();

    // Guard: skip gracefully if the seeded data has no cards (feed-less install)
    const firstCard = adminPage.locator('.line-card').first();
    const count = await adminPage.locator('.line-card').count();
    if (count === 0) {
      test.skip();
      return;
    }

    // Grab the code of the first existing card
    const existingCode = await firstCard.locator('.line-code').innerText();
    const dialog = await linesPage.editLineByCode(existingCode.trim());

    // The dialog must be open and pre-filled with the code
    await expect(dialog.locator('input[name="code"]')).toHaveValue(existingCode.trim());

    // Close without saving
    await adminPage.getByRole('button', { name: /cancel|annuler/i }).click();
    await adminPage.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('delete line → snackbar', async ({ adminPage }) => {
    const linesPage = new AdminLinesPage(adminPage);
    await linesPage.goto();

    // First make sure our E2E line exists (create it if needed)
    const existingCard = adminPage.locator('.line-card', {
      has: adminPage.locator('.line-code', { hasText: CODE }),
    });
    const exists = await existingCard.count();
    if (exists === 0) {
      await linesPage.createLine(CODE, NAME, 'BUS');
      await adminPage.locator('mat-snack-bar-container').waitFor({ state: 'hidden' });
    }

    await linesPage.deleteLineByCode(CODE);

    const snackText = await linesPage.getSnackbarText();
    expect(snackText).toBeTruthy();

    // The card must have disappeared
    await expect(existingCard).toBeHidden({ timeout: 8_000 });
  });
});
