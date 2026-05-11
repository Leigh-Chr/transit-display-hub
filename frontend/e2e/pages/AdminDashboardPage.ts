import { type Page, type Locator } from '@playwright/test';

export class AdminDashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/dashboard');
    await this.page.waitForSelector('h1');
  }

  /** Returns the text of the stat card whose label contains {@code key}. */
  async getStat(key: string | RegExp): Promise<string> {
    const card = this.page.locator('.stat-card', {
      has: this.page.locator('.stat-label', { hasText: key }),
    });
    const value = card.locator('.stat-value');
    await value.waitFor({ state: 'visible' });
    return value.innerText();
  }

  /** Clicks a nav link whose text matches {@code target}. */
  async clickNav(target: string | RegExp): Promise<void> {
    await this.page.getByRole('link', { name: target }).click();
  }
}
