import { type Page } from '@playwright/test';

export class HubPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Navigates to the hub display. Hub has no path param in the current router. */
  async goto(): Promise<void> {
    await this.page.goto('/hub');
  }

  /**
   * Navigates to the hub display for a specific device token.
   * The token is passed as a query parameter.
   */
  async gotoForDevice(token: string): Promise<void> {
    await this.page.goto(`/hub?token=${encodeURIComponent(token)}`);
  }
}
