import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '@core/services/theme.service';

/**
 * Three-button accessibility toolbar shared by the public surfaces
 * (kiosk, hub, network map). Each button is opt-in via an input so a
 * surface can omit toggles that don't make sense for it — the network
 * map has no "next departure" to read aloud, the hub aggregates many
 * stops so its speech button is also off by default.
 *
 * High-contrast and large-text toggles read / write the shared
 * {@link ThemeService} signals (persisted to localStorage, per ADR 0035),
 * so flipping one on the map and walking over to a kiosk still works.
 * Speech is parent-driven: the surface emits when it has something to
 * announce, the toolbar only owns the button.
 */
@Component({
  selector: 'app-a11y-toolbar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="a11y-toolbar" role="group" [attr.aria-label]="'a11yToolbar.groupLabel' | transloco">
      @if (showHighContrast()) {
        <button
          mat-icon-button
          type="button"
          [attr.aria-pressed]="themeService.isHighContrast()"
          [attr.aria-label]="'a11yToolbar.highContrast' | transloco"
          [matTooltip]="'a11yToolbar.highContrast' | transloco"
          (click)="themeService.toggleHighContrast()">
          <mat-icon>contrast</mat-icon>
        </button>
      }
      @if (showLargeText()) {
        <button
          mat-icon-button
          type="button"
          [attr.aria-pressed]="themeService.isLargeText()"
          [attr.aria-label]="'a11yToolbar.largeText' | transloco"
          [matTooltip]="'a11yToolbar.largeText' | transloco"
          (click)="themeService.toggleLargeText()">
          <mat-icon>format_size</mat-icon>
        </button>
      }
      @if (showSpeech()) {
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="'a11yToolbar.speak' | transloco"
          [matTooltip]="'a11yToolbar.speak' | transloco"
          [disabled]="!speechEnabled()"
          (click)="speak.emit()">
          <mat-icon>volume_up</mat-icon>
        </button>
      }
    </div>
  `,
  styles: `
    .a11y-toolbar {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
  `,
})
export class A11yToolbarComponent {
  readonly themeService = inject(ThemeService);

  readonly showHighContrast = input<boolean>(true);
  readonly showLargeText = input<boolean>(true);
  readonly showSpeech = input<boolean>(false);
  /** Greys out the speech button when the browser doesn't ship a TTS
   *  engine. Defaults to true so a surface that doesn't pass the input
   *  is treated as available. */
  readonly speechEnabled = input<boolean>(true);

  /** Fires when the user clicks the speech button. The parent owns
   *  the announcement payload — the toolbar has no opinion on what to
   *  say. */
  readonly speak = output();
}
