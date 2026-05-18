import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { LocaleService } from '@core/i18n/locale.service';
import { LineInfo } from '@shared/models';
import { lineTextColor } from '@shared/utils/color.utils';
import {
  formatDepartureTime,
  getMinutesUntil,
  isImminent,
} from '@shared/utils/time.utils';

/** Shape every booking input fits. Mirrors the inline `BookingInfo` slice
 *  hub + kiosk consumed before this row landed. */
export interface DepartureBooking {
  readonly phone: string | null;
  readonly priorNoticeMinutes: number | null;
}

/**
 * Shared block used by both the hub and the kiosk departure board: line
 * badge, optional platform label (for hubs whose rows carry the source
 * stop name), the projected destination slot (where each consumer pours
 * its own badge stack), the booking CTA, and the relative + absolute
 * time pair.
 *
 * Consumers project the destination markup via `<ng-content>` so the
 * row stays useful even when the kiosk wants to render six extra badges
 * (live, frequency, pickup, wheelchair, bikes, platform-code).
 */
@Component({
  selector: 'app-display-departures-row',
  standalone: true,
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './display-departures-row.component.html',
  styleUrl: './display-departures-row.component.scss',
})
export class DisplayDeparturesRowComponent {
  private readonly transloco = inject(TranslocoService);
  private readonly locale = inject(LocaleService);

  /** Line metadata — drives the colored badge in the first column. */
  readonly line = input.required<LineInfo>();
  /** Scheduled (or realtime-adjusted) departure time, "HH:mm" or "HH:mm:ss". */
  readonly time = input.required<string>();
  /** Reference "now" the row diffs against — passed in so multiple rows
   *  share the same clock tick instead of each calling `new Date()`. */
  readonly now = input.required<Date>();
  /** Optional platform label (hub only — rendered as a flat text column). */
  readonly platform = input<string | null>(null);
  /** Optional booking metadata — when present the CTA renders next to
   *  the destination slot. */
  readonly booking = input<DepartureBooking | null>(null);

  protected readonly lineTextColor = lineTextColor;

  protected readonly minutesUntil = computed(() => getMinutesUntil(this.time(), this.now()));
  protected readonly isImminent = computed(() => isImminent(this.time(), this.now()));
  protected readonly relativeTime = computed(() => {
    // Re-fire once Transloco's JSON is loaded so the first paint after
    // a kiosk boot resolves "kiosk.imminent" / "kiosk.minutesShort" to
    // the translated sentence instead of the raw key.
    this.locale.translationsLoaded();
    const minutes = this.minutesUntil();
    if (minutes === 0) {
      return this.transloco.translate('kiosk.imminent');
    }
    return this.transloco.translate('kiosk.minutesShort', { minutes });
  });
  protected readonly absoluteTime = computed(() => formatDepartureTime(this.time()));

  /** ARIA label for the booking badge — screen readers announce
   *  "réservation 0123456789, ≥ 30 minutes" rather than the raw glyph. */
  protected bookingAria(b: DepartureBooking): string {
    const parts: string[] = [this.transloco.translate('kiosk.booking.aria')];
    if (b.phone) { parts.push(b.phone); }
    if (b.priorNoticeMinutes !== null) {
      parts.push(this.transloco.translate('kiosk.booking.minMinutes', { minutes: b.priorNoticeMinutes }));
    }
    return parts.join(', ');
  }
}
