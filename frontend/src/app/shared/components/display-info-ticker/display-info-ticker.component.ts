import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MessageInfo } from '@shared/models';

/**
 * Bottom-anchored info / warning ticker shared by kiosk and hub.
 * Mirrors the alert banner pattern (duplicated marquee tracks, the
 * second one aria-hidden) but for non-critical INFO / WARNING
 * messages, with a slower scroll cadence supplied by the host.
 */
@Component({
  selector: 'app-display-info-ticker',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './display-info-ticker.component.html',
  styleUrl: './display-info-ticker.component.scss',
})
export class DisplayInfoTickerComponent {
  /** INFO + WARNING severity messages. Empty list hides the ticker. */
  readonly messages = input.required<MessageInfo[]>();

  /** Scroll cycle, e.g. "60s". */
  readonly durationSeconds = input<string>('60s');
}
