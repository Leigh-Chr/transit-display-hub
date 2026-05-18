import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoDirective } from '@jsverse/transloco';
import { DataOverviewService } from '@core/api/data-overview.service';
import { LocaleService } from '@core/i18n/locale.service';
import { DataOverview } from '@shared/models';
import { bcp47 } from '@shared/utils/locale-date.utils';

/**
 * Single-call snapshot of every persisted GTFS entity count plus the
 * realtime cache sizes. Hidden until the data has loaded so the
 * dashboard never flashes "0" placeholders.
 *
 * Realtime feeds appear with a dot indicator: green when the cache
 * holds data, grey when the URL is configured but empty, hidden
 * when the feed isn't configured at all. That keeps the card
 * relevant on installs without GTFS-RT.
 */
@Component({
  selector: 'app-data-overview-card',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatTooltipModule, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loaded() && overview(); as data) {
      <mat-card class="overview-card" *transloco="let t; prefix: 'admin.dashboard.overview'">
        <mat-card-content>
          <div class="overview-header">
            <mat-icon class="overview-icon">storage</mat-icon>
            <strong>{{ t('feedData') }}</strong>
          </div>

          <div class="overview-grid">
            <div class="overview-item" [matTooltip]="t('tooltipLines')">
              <span class="count">{{ data.staticGtfs.lines }}</span>
              <span class="label">{{ t('lines') }}</span>
            </div>
            <div class="overview-item" [class.has-issue]="data.staticGtfs.disabledStops > 0"
                 [matTooltip]="data.staticGtfs.disabledStops === 0
                    ? t('tooltipStops')
                    : t('tooltipStopsOrphans', { count: data.staticGtfs.disabledStops })">
              <span class="count">{{ data.staticGtfs.stops }}</span>
              <span class="label">{{ t('stops') }}</span>
              @if (data.staticGtfs.disabledStops > 0) {
                <span class="orphan-badge">−{{ data.staticGtfs.disabledStops }}</span>
              }
            </div>
            <div class="overview-item" [matTooltip]="t('tooltipItineraries')">
              <span class="count">{{ data.staticGtfs.itineraries }}</span>
              <span class="label">{{ t('itineraries') }}</span>
            </div>
            <div class="overview-item" [matTooltip]="t('tooltipSchedules')">
              <span class="count">{{ formatLarge(data.staticGtfs.schedules) }}</span>
              <span class="label">{{ t('schedules') }}</span>
            </div>
            <div class="overview-item" [matTooltip]="t('tooltipCalendars')">
              <span class="count">{{ data.staticGtfs.serviceCalendars }}</span>
              <span class="label">{{ t('calendars') }}</span>
            </div>
            @if (data.staticGtfs.transfers > 0) {
              <div class="overview-item" [matTooltip]="t('tooltipTransfers')">
                <span class="count">{{ data.staticGtfs.transfers }}</span>
                <span class="label">{{ t('transfers') }}</span>
              </div>
            }
            @if (data.staticGtfs.shapes > 0) {
              <div class="overview-item" [matTooltip]="t('tooltipShapes')">
                <span class="count">{{ data.staticGtfs.shapes }}</span>
                <span class="label">{{ t('shapes') }}</span>
              </div>
            }
            @if (data.staticGtfs.pathways > 0) {
              <div class="overview-item" [matTooltip]="t('tooltipPathways')">
                <span class="count">{{ data.staticGtfs.pathways }}</span>
                <span class="label">{{ t('pathways') }}</span>
              </div>
            }
            @if (data.staticGtfs.fareAttributes > 0) {
              <div class="overview-item" [matTooltip]="t('tooltipFares')">
                <span class="count">{{ data.staticGtfs.fareAttributes }}</span>
                <span class="label">{{ t('fares') }}</span>
              </div>
            }
            @if (data.staticGtfs.translations > 0) {
              <div class="overview-item" [matTooltip]="t('tooltipTranslations')">
                <span class="count">{{ formatLarge(data.staticGtfs.translations) }}</span>
                <span class="label">{{ t('translations') }}</span>
              </div>
            }
            @if (data.staticGtfs.bookingRules > 0) {
              <div class="overview-item" [matTooltip]="t('tooltipBookingRules')">
                <span class="count">{{ data.staticGtfs.bookingRules }}</span>
                <span class="label">{{ t('bookingRules') }}</span>
              </div>
            }
          </div>

          @if (anyRealtimeConfigured()) {
            <div class="rt-section">
              <div class="rt-header">
                <mat-icon class="rt-icon">sensors</mat-icon>
                <span>{{ t('realtime') }}</span>
              </div>
              <div class="rt-grid">
                @if (data.realtime.alertsEnabled) {
                  <div class="rt-item" [class.rt-active]="data.realtime.alerts > 0">
                    <span class="rt-dot"></span>
                    <span class="rt-label">{{ t('rtAlerts') }}</span>
                    <span class="rt-count">{{ data.realtime.alerts }}</span>
                  </div>
                }
                @if (data.realtime.tripUpdatesEnabled) {
                  <div class="rt-item" [class.rt-active]="data.realtime.tripUpdates > 0">
                    <span class="rt-dot"></span>
                    <span class="rt-label">{{ t('rtTrips') }}</span>
                    <span class="rt-count">{{ data.realtime.tripUpdates }}</span>
                  </div>
                }
                @if (data.realtime.vehiclePositionsEnabled) {
                  <div class="rt-item" [class.rt-active]="data.realtime.vehiclePositions > 0">
                    <span class="rt-dot"></span>
                    <span class="rt-label">{{ t('rtVehicles') }}</span>
                    <span class="rt-count">{{ data.realtime.vehiclePositions }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    .overview-card { margin-bottom: 16px; }

    .overview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: var(--m3-type-title-large);
    }
    .overview-icon { color: var(--mat-sys-primary); }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 12px;
    }

    .overview-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px;
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      position: relative;
    }
    .overview-item.has-issue {
      box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.45);
    }
    .count {
      font-size: var(--m3-type-headline-small);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-on-surface);
    }
    .label {
      font-size: var(--m3-type-label-medium);
      color: var(--mat-sys-on-surface-variant);
      letter-spacing: 0.02em;
      margin-top: 2px;
    }
    .orphan-badge {
      position: absolute;
      top: 4px;
      right: 6px;
      font-size: var(--m3-type-label-small);
      color: rgb(180, 134, 6);
      background: rgba(241, 196, 15, 0.18);
      border-radius: 6px;
      padding: 1px 5px;
      font-weight: 600;
    }

    .rt-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .rt-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--m3-type-body-medium);
      color: var(--mat-sys-on-surface-variant);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .rt-icon { font-size: var(--m3-type-body-large); width: 16px; height: 16px; }
    .rt-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .rt-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: var(--mat-sys-surface-container-low);
      border-radius: 999px;
      font-size: var(--m3-type-body-medium);
    }
    .rt-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--mat-sys-outline);
    }
    .rt-active .rt-dot {
      background: var(--app-success);
      box-shadow: 0 0 0 3px rgba(46, 174, 96, 0.15);
      animation: rt-pulse 2s ease-in-out infinite;
    }
    .rt-count { font-variant-numeric: tabular-nums; font-weight: 600; }

    @keyframes rt-pulse {
      0%, 100% { box-shadow: 0 0 0 3px rgba(46, 174, 96, 0.15); }
      50%      { box-shadow: 0 0 0 5px rgba(46, 174, 96, 0.05); }
    }
  `,
})
export class DataOverviewCardComponent {
  private readonly overviewService = inject(DataOverviewService);
  private readonly locale = inject(LocaleService);

  readonly overview = signal<DataOverview | null>(null);
  readonly loaded = signal<boolean>(false);

  constructor() {
    this.overviewService.getOverview().subscribe({
      next: (data) => {
        this.overview.set(data);
        this.loaded.set(true);
      },
      error: () => {
        // Same swallow-and-hide pattern as FeedInfoCard: a non-admin
        // user or a missing endpoint shouldn't crash the dashboard.
        this.loaded.set(true);
      },
    });
  }

  readonly anyRealtimeConfigured = computed<boolean>(() => {
    const o = this.overview();
    if (!o) {return false;}
    return o.realtime.alertsEnabled
        || o.realtime.tripUpdatesEnabled
        || o.realtime.vehiclePositionsEnabled;
  });

  /** Compact rendering for >=10k counts: "12 345" → "12.3k". Keeps
   *  the cell width tight on dense feeds without losing magnitude. */
  formatLarge(value: number): string {
    const tag = bcp47(this.locale.current());
    if (value < 10_000) {
      return value.toLocaleString(tag);
    }
    return (value / 1000).toLocaleString(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k';
  }
}
