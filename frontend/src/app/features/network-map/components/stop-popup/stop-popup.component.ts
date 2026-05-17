import { ChangeDetectionStrategy, Component, DestroyRef, computed, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FareCalculatorService } from '@core/api/fare-calculator.service';
import { FlexStopTimeService } from '@core/api/flex-stop-time.service';
import { ScheduleService } from '@core/api/schedule.service';
import {
  AlertMessage, BookingRule, FareCalculationResult, FlexLocation, FlexStopTime, MessageInfo,
  MessageSeverity, Schedule, StationPathwayGraph,
} from '@shared/models';
import { PathwayListComponent } from '../pathway-list/pathway-list.component';
import {
  buildViewport,
  ringToSvgPath,
  ringsFromLocation,
} from '@shared/utils/flex-locations.utils';
import { LocaleService } from '@core/i18n/locale.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { bcp47 } from '@shared/utils/locale-date.utils';
import { LINE_COLOR_FALLBACK } from '@shared/utils/color.utils';
import { NetworkMapDataService } from '../../services/network-map-data.service';
import { LayoutStop } from '../../services/schematic-layout.service';

interface RenderedTadRing {
  path: string;
}

export interface LineAlertInfo {
  lineCode: string;
  lineColor: string;
  title: string;
  content: string;
  severity: MessageSeverity;
}

export interface StopPopupData {
  stop: LayoutStop;
  lineColorMap: Map<string, string>;
  networkAlerts: AlertMessage[];
  stopAlerts: AlertMessage[];
  lineAlerts: LineAlertInfo[];
  /** Active departure stop, when the user has picked one. Triggers the
   *  "Trajet depuis [origine]" panel with a computed fare. Null when
   *  the popup is opened without a departure context (e.g. via the
   *  search field) or when the same stop is both origin and target. */
  originStop?: LayoutStop | null;
}

interface PopupMessage extends MessageInfo {
  lineCode?: string;
  lineColor?: string;
}

interface TimetableEntry {
  time: string;
  minutes: number;
  status: 'past' | 'next' | 'future';
}

interface TimetableGroup {
  itineraryId: string;
  lineCode: string;
  lineName: string;
  lineColor: string;
  directionName: string;
  times: TimetableEntry[];
}

@Component({
  selector: 'app-stop-popup',
  standalone: true,
  imports: [
    MatDialogModule, MatButtonModule, MatDividerModule, MatIconModule, MatProgressSpinnerModule,
    PathwayListComponent, TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stop-popup.component.html',
  styleUrl: './stop-popup.component.scss'
})
export class StopPopupComponent {
  private readonly scheduleService = inject(ScheduleService);
  private readonly networkMapData = inject(NetworkMapDataService);
  private readonly fareCalculator = inject(FareCalculatorService);
  private readonly flexStopTimes = inject(FlexStopTimeService);
  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = inject<StopPopupData>(MAT_DIALOG_DATA);

  loading = signal(true);
  error = signal<string | null>(null);
  timetableGroups = signal<TimetableGroup[]>([]);
  messages = signal<PopupMessage[]>([]);

  /** Fare quote between {@code data.originStop} and {@code data.stop},
   *  fetched once on init when both are set and distinct. Null while
   *  fetching, on error, or when no rule matched the pair. */
  readonly fareResult = signal<FareCalculationResult | null>(null);

  /** Next flex window starting after "now" today, picked from the list
   *  returned by /flex-windows for the stop's TAD location. Null when
   *  the stop has no flex location or when every window is past. */
  readonly nextFlexWindow = signal<FlexStopTime | null>(null);

  /** GTFS-flex zone polygon attached to this stop, lazily fetched
   *  when {@code hasOnDemand} is true. Stays null on stops without
   *  a flex location bound to them — most stops, even on TAD-heavy
   *  feeds, fall in this category. */
  readonly tadZone = signal<FlexLocation | null>(null);

  /** GTFS booking_rules attached to schedules / flex_stop_times of
   *  this stop. Lazily fetched when {@code hasOnDemand} is true so a
   *  passenger can see "phone +33… at least 1h before" inline. */
  readonly bookingRules = signal<BookingRule[]>([]);

  /** Indoor pathway graph rooted at the parent station. Always
   *  fetched when the popup opens — the section renders nothing when
   *  the graph is empty (most stops on most networks). */
  readonly pathwayGraph = signal<StationPathwayGraph | null>(null);

  /** SVG paths + viewBox for {@link tadZone}, reprojected once per
   *  zone change. Empty when no zone is loaded. */
  readonly tadZoneRings = computed<RenderedTadRing[]>(() => {
    const zone = this.tadZone();
    if (!zone) {return [];}
    const viewport = buildViewport([zone]);
    const rings = ringsFromLocation(zone, 0);
    return rings.map(r => ({ path: ringToSvgPath(r, viewport.project) }));
  });

  readonly tadZoneViewBox = computed<string>(() => {
    const zone = this.tadZone();
    if (!zone) {return '0 0 800 480';}
    return buildViewport([zone]).viewBox;
  });

  /** Human label for the fare panel — picks the V2 result first
   *  (modern Areas pipeline), falls back to V1 (zone-based). Returns
   *  null when no priced option matched, which keeps the panel hidden. */
  readonly fareLabel = computed<string | null>(() => {
    const result = this.fareResult();
    if (!result) {return null;}
    const v2 = result.v2[0];
    if (v2?.amount !== null && v2?.currency) {
      return this.formatCurrency(v2.amount, v2.currency);
    }
    const v1 = result.v1[0];
    if (v1 && v1.price !== null) {
      return this.formatCurrency(v1.price, v1.currency);
    }
    return null;
  });

  /** Secondary label below the price, surfaced only when the matched
   *  rule carries useful context (product name for V2, agency / zone
   *  match for V1). */
  readonly fareDetail = computed<string | null>(() => {
    const result = this.fareResult();
    if (!result) {return null;}
    const v2 = result.v2[0];
    if (v2 && v2.amount !== null) {
      return v2.fareProductName ?? null;
    }
    const v1 = result.v1[0];
    if (v1) {
      return v1.agencyName ?? v1.matchedRoute ?? null;
    }
    return null;
  });

  /** Human label for the flex window panel, formatted as
   *  "HH:mm → HH:mm". Null when no upcoming window. */
  readonly nextFlexLabel = computed<string | null>(() => {
    const window = this.nextFlexWindow();
    if (!window) {return null;}
    return `${this.shortTime(window.startPickupDropOffWindow)} → ${this.shortTime(window.endPickupDropOffWindow)}`;
  });

  /** Trip headsign / line code for the next flex window, when set. */
  readonly nextFlexHeadsign = computed<string | null>(() => {
    const window = this.nextFlexWindow();
    if (!window) {return null;}
    return window.stopHeadsign ?? window.lineCode ?? window.itineraryName ?? null;
  });

  private static readonly SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 0,
    WARNING: 1,
    INFO: 2,
  };

  constructor() {
    this.buildMessages();
    this.loadSchedules();
    // takeUntilDestroyed everywhere: a popup can be closed before its
    // HTTP fan-out (TAD zone, booking rules, pathway graph, fare,
    // flex windows) returns; without the operator the late callback
    // would still try to signal.set on a destroyed component.
    if (this.data.stop.hasOnDemand) {
      this.networkMapData.getStopTadZone(this.data.stop.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(zone => {
          this.tadZone.set(zone);
          if (zone) {
            this.loadNextFlexWindow(zone);
          }
        });
      this.networkMapData.getStopBookingRules(this.data.stop.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(rules => {
          this.bookingRules.set(rules);
        });
    }
    this.networkMapData.getStopPathwayGraph(this.data.stop.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(graph => {
        this.pathwayGraph.set(graph);
      });
    const origin = this.data.originStop;
    if (origin && origin.id !== this.data.stop.id) {
      this.fareCalculator.calculate(origin.id, this.data.stop.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(result => {
          this.fareResult.set(result);
        });
    }
  }

  /** Pull today's flex windows for the stop's TAD location, then keep
   *  the first one starting after the current local time. Silently
   *  drops the section when nothing is upcoming. */
  private loadNextFlexWindow(zone: FlexLocation): void {
    this.flexStopTimes.getWindowsForLocation(zone.externalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(windows => {
      if (windows.length === 0) {
        this.nextFlexWindow.set(null);
        return;
      }
      const now = new Date();
      const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const upcoming = windows
          .filter(w => this.timeToSeconds(w.startPickupDropOffWindow) >= nowSecs)
          .sort((a, b) =>
              this.timeToSeconds(a.startPickupDropOffWindow)
              - this.timeToSeconds(b.startPickupDropOffWindow));
      this.nextFlexWindow.set(upcoming[0] ?? null);
    });
  }

  private timeToSeconds(time: string): number {
    const parts = time.split(':');
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    const s = parseInt(parts[2] ?? '0', 10);
    return h * 3600 + m * 60 + s;
  }

  private shortTime(time: string): string {
    const parts = time.split(':');
    return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
  }

  /** Format an amount using {@code Intl.NumberFormat} when an ISO 4217
   *  currency code is provided, falls back to a plain number + suffix
   *  when the currency is unknown. */
  private formatCurrency(amount: number, currency: string | null): string {
    if (currency) {
      try {
        return new Intl.NumberFormat(bcp47(this.locale.current()), {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${amount.toFixed(2)} ${currency}`;
      }
    }
    return amount.toFixed(2);
  }

  /** Format a booking-rule prior_notice_duration_min into a human label
   *  ("au moins 30 min", "au moins 2h"). Returns null when the rule
   *  doesn't carry a value. */
  formatPriorNotice(rule: BookingRule): string | null {
    const min = rule.priorNoticeDurationMin;
    if (min === null) {return null;}
    if (min >= 3600) {
      return this.transloco.translate('map.stopPopup.priorNoticeHours', {
        hours: Math.round(min / 3600),
      });
    }
    return this.transloco.translate('map.stopPopup.priorNoticeMinutes', {
      minutes: Math.round(min / 60),
    });
  }

  bookingTypeLabel(rule: BookingRule): string {
    const key = `map.stopPopup.bookingType.${rule.bookingType ?? 'default'}`;
    const translated = this.transloco.translate(key);
    return translated === key
      ? this.transloco.translate('map.stopPopup.bookingType.default')
      : translated;
  }

  private buildMessages(): void {
    const networkMsgs: PopupMessage[] = this.data.networkAlerts
      .map(a => ({ title: a.title, content: a.content, severity: a.severity }));

    const stopMsgs: PopupMessage[] = this.data.stopAlerts
      .map(a => ({ title: a.title, content: a.content, severity: a.severity }));

    const lineMsgs: PopupMessage[] = this.data.lineAlerts
      .map(a => ({ title: a.title, content: a.content, severity: a.severity, lineCode: a.lineCode, lineColor: a.lineColor }));

    const result = [...networkMsgs, ...stopMsgs, ...lineMsgs].sort((a, b) =>
      (StopPopupComponent.SEVERITY_ORDER[a.severity] ?? 9) -
      (StopPopupComponent.SEVERITY_ORDER[b.severity] ?? 9)
    );

    this.messages.set(result);
  }

  private loadSchedules(): void {
    this.loading.set(true);
    this.error.set(null);

    this.scheduleService.getForStop(this.data.stop.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (schedules: Schedule[]) => {
        this.timetableGroups.set(this.buildTimetableGroups(schedules));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load schedules');
        this.loading.set(false);
      }
    });
  }

  private buildTimetableGroups(schedules: Schedule[]): TimetableGroup[] {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const grouped = new Map<string, { group: Omit<TimetableGroup, 'times'>; entries: TimetableEntry[] }>();

    for (const s of schedules) {
      const it = s.itinerary;
      if (!grouped.has(it.id)) {
        grouped.set(it.id, {
          group: {
            itineraryId: it.id,
            lineCode: it.line.code,
            lineName: it.line.name,
            lineColor: it.line.color,
            directionName: it.terminusName ?? it.name,
          },
          entries: [],
        });
      }

      const parts = s.time.split(':');
      const minutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
      const time = `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;

      grouped.get(it.id)?.entries.push({
        time,
        minutes,
        status: minutes < currentMinutes ? 'past' : 'future',
      });
    }

    const groups: TimetableGroup[] = [];

    for (const { group, entries } of grouped.values()) {
      entries.sort((a, b) => a.minutes - b.minutes);

      // Mark the first future entry as 'next'
      const nextIdx = entries.findIndex(e => e.status === 'future');
      const nextEntry = entries[nextIdx];
      if (nextIdx !== -1 && nextEntry) {
        nextEntry.status = 'next';
      }

      groups.push({ ...group, times: entries });
    }

    groups.sort((a, b) =>
      a.lineCode.localeCompare(b.lineCode, undefined, { numeric: true }) ||
      a.directionName.localeCompare(b.directionName)
    );

    return groups;
  }

  getLineColor(code: string): string {
    return this.data.lineColorMap.get(code) ?? LINE_COLOR_FALLBACK;
  }

  /** True when the stop has at least one accessibility / TAD / zone
   *  signal worth surfacing — keeps the metadata row out of the
   *  popup entirely on stops without notable info, so the popup
   *  stays light on dense networks. */
  showStopMeta(): boolean {
    return this.data.stop.hasOnDemand === true
        || this.data.stop.wheelchairBoarding === 'ACCESSIBLE'
        || this.data.stop.wheelchairBoarding === 'NOT_ACCESSIBLE'
        || (this.data.stop.fareAreaNames?.length ?? 0) > 0;
  }

  getMessageIcon(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return 'error';
      case 'WARNING': return 'warning';
      default: return 'info';
    }
  }
}
