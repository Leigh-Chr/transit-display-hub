import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MessageInfo } from '@shared/models';

/**
 * Scrolling banner that announces CRITICAL service disruptions on
 * both the kiosk and hub passenger displays. Replaces the 1:1 copy
 * that used to live in each component's HTML so the markup, the
 * a11y wiring (role/aria-live/aria-atomic + aria-hidden on the
 * duplicated marquee), and the keyframe-friendly DOM stay in lockstep.
 *
 * Visual theming (background colour, font sizes) is driven by the
 * host page through the existing {@code --app-kiosk-alert-*} /
 * {@code --app-hub-alert-*} CSS variables; the banner reads them
 * via the generic {@code --app-display-alert-*} aliases so each
 * host just maps the alias once.
 */
@Component({
  selector: 'app-display-alert-banner',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './display-alert-banner.component.html',
  styleUrl: './display-alert-banner.component.scss',
})
export class DisplayAlertBannerComponent {
  /** Critical-severity messages to scroll. Empty list hides the banner. */
  readonly messages = input.required<MessageInfo[]>();

  /** Scroll cycle length, e.g. "30s". Empty falls back to the SCSS default. */
  readonly durationSeconds = input<string>('30s');
}
