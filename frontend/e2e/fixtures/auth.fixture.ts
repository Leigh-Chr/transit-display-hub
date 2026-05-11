import { test as base, type Page } from '@playwright/test';

/**
 * Extended test fixture that provides an {@code adminPage}: a browser
 * page pre-authenticated as admin by reusing the storage state that
 * {@code global-setup.ts} persisted in {@code e2e/.auth/admin.json}.
 *
 * Tests that need a fresh, unauthenticated page should use the
 * built-in {@code page} fixture instead.
 */
export const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
