import { test, expect } from '@playwright/test';

/**
 * Locale persistence tests.
 *
 * {@link LocaleService} stores the selected language in
 * {@code localStorage['lang']}. After toggling and reloading the page
 * the same language should be active.
 *
 * Tested on the public /map page because it exposes the lang-toggle
 * button and does not require authentication.
 */
test.describe('Locale persistence', () => {
  test('default locale is fr or en (a supported language)', async ({ page }) => {
    await page.goto('/map');
    await page.waitForSelector('h1');

    const lang = await page.evaluate(() => localStorage.getItem('lang'));
    // On first visit the value may not be set yet (falls back to navigator.language)
    // The important thing is that it is either null, 'fr', or 'en'
    expect(['fr', 'en', null]).toContain(lang);
  });

  test('toggling locale persists to localStorage', async ({ page }) => {
    await page.goto('/map');
    await page.waitForSelector('h1');

    // The toggle button label is the OTHER language. Read it as the
    // source of truth for the current active locale — localStorage may
    // still be null on first visit (we fall back to navigator.language).
    const toggleBtn = page.locator('.lang-toggle');
    await expect(toggleBtn).toBeVisible();
    const expectedAfter = (await toggleBtn.innerText()).trim().toLowerCase();

    await toggleBtn.click();

    const after = await page.evaluate(() => localStorage.getItem('lang'));
    expect(after).toBe(expectedAfter);
  });

  test('locale survives a page reload', async ({ page }) => {
    await page.goto('/map');
    await page.waitForSelector('h1');

    // Force the locale to 'en' and verify it persists
    await page.evaluate(() => localStorage.setItem('lang', 'en'));
    await page.reload();
    await page.waitForSelector('h1');

    const stored = await page.evaluate(() => localStorage.getItem('lang'));
    expect(stored).toBe('en');

    // The lang-toggle should reflect 'en' (showing "FR" to switch back)
    const toggleBtn = page.locator('.lang-toggle');
    await expect(toggleBtn).toHaveText('FR');
  });

  test('FR ↔ EN toggle cycle works both ways', async ({ page }) => {
    await page.goto('/map');
    await page.waitForSelector('h1');

    const toggleBtn = page.locator('.lang-toggle');
    await expect(toggleBtn).toBeVisible();

    // Start from a known state
    await page.evaluate(() => localStorage.setItem('lang', 'fr'));
    await page.reload();
    await page.waitForSelector('h1');

    // fr → en
    await page.locator('.lang-toggle').click();
    expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('en');

    // en → fr
    await page.locator('.lang-toggle').click();
    expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('fr');
  });
});
