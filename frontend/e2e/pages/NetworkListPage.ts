import { type Page } from '@playwright/test';

export class NetworkListPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/map/list');
    await this.page.waitForSelector('h1');
  }

  /** Returns the number of stop rows currently rendered in the table. */
  async getRowCount(): Promise<number> {
    // The list renders stops as <li> elements inside a .stops-list
    const rows = this.page.locator('.stops-list li, .stop-row, table tbody tr');
    return rows.count();
  }
}
