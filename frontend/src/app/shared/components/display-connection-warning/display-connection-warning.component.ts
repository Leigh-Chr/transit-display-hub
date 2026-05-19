import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Floating connection-status pill used by both display boards (kiosk
 * single-stop and hub multi-stop). Renders nothing when the websocket
 * is healthy and the data is fresh.
 *
 * `connected=false`  →  "reconnecting" (animated pulse).
 * `connected=true && isStale=true`  →  "stale, last update N min ago".
 */
@Component({
  selector: 'app-display-connection-warning',
  standalone: true,
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!connected()) {
      <div class="connection-warning" role="status" aria-live="polite">
        <mat-icon aria-hidden="true">wifi_off</mat-icon>
        {{ 'kiosk.connection.reconnecting' | transloco }}
      </div>
    } @else if (isStale()) {
      <div class="connection-warning stale-warning" role="status" aria-live="polite">
        <mat-icon aria-hidden="true">schedule</mat-icon>
        {{ 'kiosk.connection.stale' | transloco: { minutes: staleMinutes() } }}
      </div>
    }
  `,
  styleUrl: './display-connection-warning.component.scss',
})
export class DisplayConnectionWarningComponent {
  readonly connected = input.required<boolean>();
  readonly isStale = input(false);
  readonly staleMinutes = input(0);
}
