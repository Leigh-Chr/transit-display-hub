import { type Page, type Locator } from '@playwright/test';

export class AdminLinesPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/lines');
    // Wait for the page title to confirm the component loaded
    await this.page.waitForSelector('h1');
    // On mobile-chrome the admin sidenav opens as an overlay drawer and
    // intercepts pointer events on the main content. Close it so the
    // CRUD buttons below are actually clickable.
    const scrim = this.page.locator('.mat-drawer-backdrop:visible');
    if (await scrim.count() > 0) {
      await scrim.first().click().catch(() => undefined);
    }
  }

  /** Opens the "New line" dialog and fills in the minimum required fields. */
  async createLine(code: string, name: string, type = 'BUS'): Promise<void> {
    // The create button text is translated; match by icon + role
    const createBtn = this.page.getByRole('button', { name: /new line|nouvelle ligne/i });
    await createBtn.click();
    await this.page.waitForSelector('mat-dialog-container');

    await this.page.locator('input[name="code"]').fill(code);
    await this.page.locator('input[name="name"]').fill(name);

    // Select the type from the mat-select
    await this.page.locator('mat-select[name="type"]').click();
    await this.page.locator(`mat-option`, { hasText: type }).first().click();

    // The submit label depends on EN ("Create Line" / "Save Changes")
    // vs FR ("Créer la ligne" / "Enregistrer") and on create-vs-edit mode,
    // so we target the primary action in mat-dialog-actions instead of
    // racing against four possible labels.
    await this.page.locator('mat-dialog-actions button[color="primary"]').click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  /** Opens the edit dialog for the card whose header code matches {@code code}. */
  async editLineByCode(code: string): Promise<Locator> {
    const card = this._getCardByCode(code);
    await card.getByRole('button', { name: /edit|modifier/i }).click();
    await this.page.waitForSelector('mat-dialog-container');
    return this.page.locator('mat-dialog-container');
  }

  /** Clicks the delete button on the card with the matching code and confirms. */
  async deleteLineByCode(code: string): Promise<void> {
    const card = this._getCardByCode(code);
    await card.getByRole('button', { name: /delete|supprimer/i }).click();
    // Confirmation dialog
    await this.page.waitForSelector('mat-dialog-container');
    await this.page.getByRole('button', { name: /confirm|delete|supprimer|oui/i }).last().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  /** Returns the text of the currently visible Material snackbar. */
  async getSnackbarText(): Promise<string> {
    const snack = this.page.locator('mat-snack-bar-container');
    await snack.waitFor({ state: 'visible', timeout: 8_000 });
    return snack.innerText();
  }

  private _getCardByCode(code: string): Locator {
    return this.page.locator('.line-card', {
      has: this.page.locator('.line-code', { hasText: code }),
    });
  }
}
