import { ChangeDetectionStrategy, Component, OnInit, computed, signal, inject } from '@angular/core';
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
import { bcp47 } from '@shared/utils/locale-date.utils';
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
    PathwayListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-header">
      <div class="stop-info">
        <h2 mat-dialog-title>{{ data.stop.name }}</h2>
        <div class="line-badges">
          @for (code of data.stop.lineCodes; track code) {
            <span class="line-badge" [style.backgroundColor]="getLineColor(code)">
              {{ code }}
            </span>
          }
        </div>
        @if (showStopMeta()) {
          <div class="stop-meta">
            @if (data.stop.hasOnDemand) {
              <span class="meta-pill meta-tad">
                <mat-icon>phone_callback</mat-icon>
                Réservation requise
              </span>
            }
            @if (data.stop.wheelchairBoarding === 'ACCESSIBLE') {
              <span class="meta-pill meta-access">
                <mat-icon>accessible_forward</mat-icon>
                Accessible PMR
              </span>
            } @else if (data.stop.wheelchairBoarding === 'NOT_ACCESSIBLE') {
              <span class="meta-pill meta-no-access">
                <mat-icon>do_not_disturb</mat-icon>
                Non accessible
              </span>
            }
            @for (zone of data.stop.fareAreaNames ?? []; track zone) {
              <span class="meta-pill meta-zone">
                <mat-icon>place</mat-icon>
                {{ zone }}
              </span>
            }
          </div>
        }
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      @if (messages().length > 0) {
        <div class="messages-section">
          @for (msg of messages(); track $index) {
            <div class="message-card" [class]="'message-card severity-' + msg.severity.toLowerCase()">
              <mat-icon class="message-icon">{{ getMessageIcon(msg.severity) }}</mat-icon>
              <div class="message-body">
                <div class="message-header">
                  @if (msg.lineCode) {
                    <span class="line-badge small" [style.backgroundColor]="msg.lineColor">{{ msg.lineCode }}</span>
                  }
                  <strong class="message-title">{{ msg.title }}</strong>
                </div>
                @if (msg.content) {
                  <span class="message-content">{{ msg.content }}</span>
                }
              </div>
            </div>
          }
        </div>
      }

      @if (tadZone(); as zone) {
        <div class="tad-zone-section">
          <h3 class="section-title">
            <mat-icon>layers</mat-icon>
            Zone de prise en charge — {{ zone.name || zone.externalId }}
          </h3>
          <svg
            class="tad-zone-canvas"
            [attr.viewBox]="tadZoneViewBox()"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            [attr.aria-label]="'Polygone de la zone TAD ' + (zone.name || zone.externalId)">
            @for (ring of tadZoneRings(); track $index) {
              <path
                [attr.d]="ring.path"
                fill="rgba(99, 102, 241, 0.32)"
                stroke="rgb(67, 56, 202)"
                stroke-width="1.5"
                fill-rule="evenodd"
                vector-effect="non-scaling-stroke" />
            }
          </svg>
        </div>
        <mat-divider />
      }

      @if (pathwayGraph(); as graph) {
        @if (graph.pathways.length > 0) {
          <app-pathway-list [graph]="graph" />
          <mat-divider />
        }
      }

      @if (fareLabel(); as label) {
        <div class="fare-section">
          <h3 class="section-title">
            <mat-icon>local_atm</mat-icon>
            Trajet depuis {{ data.originStop?.name }}
          </h3>
          <div class="fare-card">
            <div class="fare-amount">{{ label }}</div>
            @if (fareDetail(); as detail) {
              <div class="fare-detail">{{ detail }}</div>
            }
          </div>
        </div>
        <mat-divider />
      }

      @if (nextFlexLabel(); as label) {
        <div class="flex-window-section">
          <h3 class="section-title">
            <mat-icon>schedule</mat-icon>
            Réservation TAD aujourd'hui
          </h3>
          <div class="flex-window-card">
            <span class="flex-window-time">{{ label }}</span>
            @if (nextFlexHeadsign(); as headsign) {
              <span class="flex-window-headsign">{{ headsign }}</span>
            }
          </div>
        </div>
        <mat-divider />
      }

      @if (bookingRules().length > 0) {
        <div class="booking-rules-section">
          <h3 class="section-title">
            <mat-icon>phone_callback</mat-icon>
            Comment réserver
          </h3>
          @for (rule of bookingRules(); track rule.id) {
            <div class="booking-rule-card">
              <div class="rule-header">
                <strong>{{ bookingTypeLabel(rule) }}</strong>
                @if (formatPriorNotice(rule); as notice) {
                  <span class="rule-notice">{{ notice }}</span>
                }
              </div>
              @if (rule.message) {
                <p class="rule-message">{{ rule.message }}</p>
              }
              <div class="rule-actions">
                @if (rule.phone) {
                  <a class="rule-action rule-action-phone" [href]="'tel:' + rule.phone" rel="noopener">
                    <mat-icon>phone</mat-icon>
                    {{ rule.phone }}
                  </a>
                }
                @if (rule.bookingUrl) {
                  <a class="rule-action rule-action-book" [href]="rule.bookingUrl" target="_blank" rel="noopener noreferrer">
                    <mat-icon>open_in_new</mat-icon>
                    Réserver en ligne
                  </a>
                }
                @if (rule.infoUrl) {
                  <a class="rule-action rule-action-info" [href]="rule.infoUrl" target="_blank" rel="noopener noreferrer">
                    <mat-icon>info</mat-icon>
                    Plus d'infos
                  </a>
                }
              </div>
            </div>
          }
        </div>
        <mat-divider />
      }

      @if (messages().length > 0 && !loading()) {
        <mat-divider />
      }

      @if (loading()) {
        <div class="loading">
          <mat-spinner diameter="32" aria-label="Loading schedules"></mat-spinner>
          <span>Loading schedules...</span>
        </div>
      } @else if (error()) {
        <div class="error">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error() }}</span>
        </div>
      } @else if (timetableGroups().length === 0) {
        <div class="empty">
          <mat-icon>schedule</mat-icon>
          <span>No scheduled departures</span>
        </div>
      } @else {
        @for (group of timetableGroups(); track group.itineraryId) {
          <div class="timetable-group">
            <div class="group-header">
              <span class="line-badge small" [style.backgroundColor]="group.lineColor">
                {{ group.lineCode }}
              </span>
              <mat-icon class="direction-arrow">arrow_forward</mat-icon>
              <span class="direction-name">{{ group.directionName }}</span>
            </div>
            <div class="time-grid">
              @for (entry of group.times; track entry.time) {
                <span
                  class="time-cell"
                  [class.time-past]="entry.status === 'past'"
                  [class.time-next]="entry.status === 'next'"
                  [class.time-future]="entry.status === 'future'"
                  [style.backgroundColor]="entry.status === 'next' ? group.lineColor + '33' : null"
                  [style.color]="entry.status === 'next' ? group.lineColor : null"
                >{{ entry.time }}</span>
              }
            </div>
          </div>
        }
      }
    </mat-dialog-content>
  `,
  styles: `
    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px 20px 16px;
    }

    .stop-info h2 {
      margin: 0 0 10px 0;
    }

    .line-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .line-badge {
      padding: 5px 12px;
      border-radius: var(--app-radius-sm);
      font-size: 0.875rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .line-badge.small {
      padding: 3px 10px;
      font-size: 0.75rem;
      border-radius: var(--app-radius-xs);
      flex-shrink: 0;
    }

    /* Accessibility / TAD metadata row — only renders when at least
       one signal is meaningful, see showStopMeta(). */
    .stop-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .meta-pill mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .meta-pill.meta-tad {
      background: rgba(56, 142, 235, 0.16);
      color: rgb(34, 105, 192);
      border: 1px solid rgba(56, 142, 235, 0.55);
    }
    .meta-pill.meta-access {
      background: rgba(46, 204, 113, 0.16);
      color: rgb(46, 174, 96);
      border: 1px solid rgba(46, 204, 113, 0.55);
    }
    .meta-pill.meta-no-access {
      background: rgba(231, 76, 60, 0.14);
      color: rgb(180, 50, 38);
      border: 1px solid rgba(231, 76, 60, 0.5);
    }
    .meta-pill.meta-zone {
      background: rgba(96, 56, 200, 0.14);
      color: rgb(72, 38, 156);
      border: 1px solid rgba(96, 56, 200, 0.5);
    }

    :host {
      --mat-dialog-content-padding: 0;
      --mat-dialog-headline-padding: 0;
      --mat-dialog-subhead-size: 1.375rem;
      --mat-dialog-subhead-weight: 600;
      --mat-dialog-subhead-color: var(--app-on-surface);
    }

    /* --- Messages --- */

    .tad-zone-section {
      padding: 16px 20px 12px;
    }
    .tad-zone-section .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 8px;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }
    .tad-zone-section .section-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .tad-zone-canvas {
      display: block;
      width: 100%;
      height: 220px;
      background: var(--mat-sys-surface-container-low);
      border-radius: 6px;
    }

    .fare-section,
    .flex-window-section {
      padding: 14px 20px 16px;
    }
    .fare-section .section-title,
    .flex-window-section .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 8px;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }
    .fare-section .section-title mat-icon,
    .flex-window-section .section-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .fare-card {
      display: flex;
      align-items: baseline;
      gap: 14px;
      padding: 10px 14px;
      background: var(--mat-sys-surface-container-low);
      border-left: 3px solid #16a34a;
      border-radius: 4px;
    }
    .fare-amount {
      font-size: 1.15rem;
      font-weight: 700;
      color: #166534;
      letter-spacing: 0.01em;
    }
    .fare-detail {
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .flex-window-card {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 14px;
      background: var(--mat-sys-surface-container-low);
      border-left: 3px solid rgb(56, 142, 235);
      border-radius: 4px;
    }
    .flex-window-time {
      font-size: 0.95rem;
      font-weight: 700;
      color: rgb(34, 105, 192);
      font-variant-numeric: tabular-nums;
    }
    .flex-window-headsign {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .booking-rules-section {
      padding: 14px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .booking-rules-section .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 4px;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }
    .booking-rules-section .section-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .booking-rule-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      background: var(--mat-sys-surface-container-low);
      border-left: 3px solid var(--mat-sys-tertiary, #6366f1);
      border-radius: 4px;
    }
    .rule-header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      font-size: 0.92rem;
    }
    .rule-notice {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .rule-message {
      margin: 0;
      font-size: 0.85rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.4;
    }
    .rule-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .rule-action {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 500;
      text-decoration: none;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .rule-action mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .rule-action-phone {
      background: rgba(16, 185, 129, 0.16);
      color: #047857;
    }
    .rule-action-book {
      background: rgba(99, 102, 241, 0.16);
      color: #4338ca;
    }

    .messages-section {
      display: flex;
      flex-direction: column;
      gap: 1px;
      background: var(--app-surface-variant);
    }

    .message-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 20px;
      background: var(--app-surface);
    }

    .message-icon {
      flex-shrink: 0;
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-top: 1px;
    }

    .message-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .message-title {
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.3;
    }

    .message-content {
      font-size: 0.75rem;
      line-height: 1.4;
      opacity: 0.7;
    }

    .severity-critical .message-icon,
    .severity-critical .message-title {
      color: var(--app-critical);
    }

    .severity-critical .message-content {
      color: color-mix(in srgb, var(--app-critical) 70%, transparent);
    }

    .severity-warning .message-icon,
    .severity-warning .message-title {
      color: var(--app-warning);
    }

    .severity-warning .message-content {
      color: color-mix(in srgb, var(--app-warning) 70%, transparent);
    }

    .severity-info .message-icon,
    .severity-info .message-title {
      color: var(--app-info);
    }

    .severity-info .message-content {
      color: color-mix(in srgb, var(--app-info) 70%, transparent);
    }

    /* --- Loading / Error / Empty --- */

    .loading,
    .error,
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px 20px;
      color: var(--app-on-surface-muted);
      text-align: center;
    }

    .error {
      color: var(--app-critical);
    }

    .error mat-icon,
    .empty mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    /* --- Timetable --- */

    .timetable-group {
      border-bottom: 1px solid var(--app-outline);
    }

    .timetable-group:last-child {
      border-bottom: none;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px 0;
    }

    .direction-arrow {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--app-on-surface-muted);
    }

    .direction-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--app-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .time-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      padding: 8px 20px 12px;
    }

    .time-cell {
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
      padding: 2px 6px;
      border-radius: var(--app-radius-xs);
      line-height: 1.4;
    }

    .time-past {
      opacity: 0.3;
    }

    .time-next {
      font-weight: 700;
    }
  `
})
export class StopPopupComponent implements OnInit {
  private readonly scheduleService = inject(ScheduleService);
  private readonly networkMapData = inject(NetworkMapDataService);
  private readonly fareCalculator = inject(FareCalculatorService);
  private readonly flexStopTimes = inject(FlexStopTimeService);
  private readonly locale = inject(LocaleService);
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

  ngOnInit(): void {
    this.buildMessages();
    this.loadSchedules();
    if (this.data.stop.hasOnDemand) {
      this.networkMapData.getStopTadZone(this.data.stop.id).subscribe(zone => {
        this.tadZone.set(zone);
        if (zone) {
          this.loadNextFlexWindow(zone);
        }
      });
      this.networkMapData.getStopBookingRules(this.data.stop.id).subscribe(rules => {
        this.bookingRules.set(rules);
      });
    }
    this.networkMapData.getStopPathwayGraph(this.data.stop.id).subscribe(graph => {
      this.pathwayGraph.set(graph);
    });
    const origin = this.data.originStop;
    if (origin && origin.id !== this.data.stop.id) {
      this.fareCalculator.calculate(origin.id, this.data.stop.id).subscribe(result => {
        this.fareResult.set(result);
      });
    }
  }

  /** Pull today's flex windows for the stop's TAD location, then keep
   *  the first one starting after the current local time. Silently
   *  drops the section when nothing is upcoming. */
  private loadNextFlexWindow(zone: FlexLocation): void {
    this.flexStopTimes.getWindowsForLocation(zone.externalId).subscribe(windows => {
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
      const hours = Math.round(min / 3600);
      return `au moins ${hours}h à l'avance`;
    }
    return `au moins ${Math.round(min / 60)} min à l'avance`;
  }

  bookingTypeLabel(rule: BookingRule): string {
    switch (rule.bookingType) {
      case 'REAL_TIME': return 'Réservation temps réel';
      case 'SAME_DAY': return 'Réservation le jour même';
      case 'PRIOR_DAYS': return 'Réservation à l\'avance';
      default: return 'Réservation';
    }
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

    this.scheduleService.getForStop(this.data.stop.id).subscribe({
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
    return this.data.lineColorMap.get(code) ?? '#666';
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
