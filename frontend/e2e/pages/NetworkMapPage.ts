import { type Page } from '@playwright/test';

export class NetworkMapPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/map');
    await this.page.waitForSelector('h1');
  }

  async goToList(): Promise<void> {
    const listLink = this.page.getByRole('link', { name: /accessible|liste|list/i });
    await listLink.click();
    await this.page.waitForURL(/\/map\/list$/);
  }

  /** Clicks the SVG stop node whose accessible name contains {@code name}. */
  async clickStop(name: string): Promise<void> {
    // The SVG renders stops as <circle> or <g> elements; fall back to a
    // text match inside the SVG if there is no title element.
    const stopEl = this.page.locator(`[data-stop-name="${name}"], svg text`).filter({ hasText: name }).first();
    await stopEl.click();
  }
}
