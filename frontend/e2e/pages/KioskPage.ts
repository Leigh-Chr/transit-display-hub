import { type Page } from '@playwright/test';

export class KioskPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigates to the kiosk display for a given device token.
   * The token is passed as a query parameter: {@code /display?token=<token>}.
   */
  async gotoForDevice(token: string): Promise<void> {
    await this.page.goto(`/display?token=${encodeURIComponent(token)}`);
  }

  /**
   * Navigates to the kiosk display for a known stop ID (no-auth public route).
   */
  async gotoForStop(stopId: string): Promise<void> {
    await this.page.goto(`/display/${encodeURIComponent(stopId)}`);
  }
}
