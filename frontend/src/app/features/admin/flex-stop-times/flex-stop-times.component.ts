import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FlexStopTimeService } from '@core/api/flex-stop-time.service';
import { FlexStopTime } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { httpErrorMessage } from '@shared/utils/http.utils';

/**
 * Browse the GTFS-flex stop_times — the on-demand counterpart of
 * `schedules`. Each row defines a pickup/drop-off window over a fixed
 * stop, a flex location (polygon) or a location group (cluster of
 * stops). Empty on every feed that doesn't ship flex data.
 */
@Component({
  selector: 'app-flex-stop-times',
  standalone: true,
  imports: [
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <div class="flex-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.flexStopTimes.title') }}</h1>
        <p class="page-subtitle">{{ t('admin.flexStopTimes.subtitle') }}</p>
      </div>

      @if (loadError()) {
        <mat-card>
          <app-empty-state
            icon="error_outline"
            [title]="t('admin.flexStopTimes.loadFailed')"
            [description]="t('admin.common.loadErrorDescription')"
            [actionLabel]="t('common.refresh')"
            actionIcon="refresh"
            (action)="loadRows()" />
        </mat-card>
      } @else if (rows().length === 0) {
        <mat-card>
          <app-empty-state
            icon="phone_callback"
            [title]="t('admin.flexStopTimes.emptyTitle')"
            [description]="t('admin.flexStopTimes.emptyDesc')" />
        </mat-card>
      } @else {
        <mat-card animate.enter="fade-in">
          <div class="legend">
            <span class="legend-pill pill-target-stop"><mat-icon>place</mat-icon>{{ t('admin.flexStopTimes.legendStop') }}</span>
            <span class="legend-pill pill-target-location"><mat-icon>layers</mat-icon>{{ t('admin.flexStopTimes.legendLocation') }}</span>
            <span class="legend-pill pill-target-group"><mat-icon>group_work</mat-icon>{{ t('admin.flexStopTimes.legendGroup') }}</span>
          </div>
          <table mat-table [dataSource]="rows()" class="full-width">
            <ng-container matColumnDef="line">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.flexStopTimes.colLine') }}</th>
              <td mat-cell *matCellDef="let r">
                @if (r.lineCode) {
                  <span class="line-badge" [style.backgroundColor]="r.lineColor">{{ r.lineCode }}</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="itinerary">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.flexStopTimes.colItinerary') }}</th>
              <td mat-cell *matCellDef="let r">{{ r.itineraryName || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="target">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.flexStopTimes.colTarget') }}</th>
              <td mat-cell *matCellDef="let r">
                @if (r.locationExternalId) {
                  <span class="legend-pill pill-target-location">
                    <mat-icon>layers</mat-icon>
                    {{ r.locationName || r.locationExternalId }}
                  </span>
                } @else if (r.locationGroupExternalId) {
                  <span class="legend-pill pill-target-group">
                    <mat-icon>group_work</mat-icon>
                    {{ r.locationGroupName || r.locationGroupExternalId }}
                  </span>
                } @else if (r.stopName) {
                  <span class="legend-pill pill-target-stop">
                    <mat-icon>place</mat-icon>
                    {{ r.stopName }}
                  </span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="window">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.flexStopTimes.colWindow') }}</th>
              <td mat-cell *matCellDef="let r" class="time-cell">
                {{ formatTime(r.startPickupDropOffWindow) }} → {{ formatTime(r.endPickupDropOffWindow) }}
              </td>
            </ng-container>

            <ng-container matColumnDef="bookings">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.flexStopTimes.colBookings') }}</th>
              <td mat-cell *matCellDef="let r">
                @if (r.pickupBookingRuleExternalId) {
                  <span class="rule-tag" matTooltip="pickup_booking_rule_id">
                    ↑ {{ r.pickupBookingRuleExternalId }}
                  </span>
                }
                @if (r.dropOffBookingRuleExternalId
                     && r.dropOffBookingRuleExternalId !== r.pickupBookingRuleExternalId) {
                  <span class="rule-tag" matTooltip="drop_off_booking_rule_id">
                    ↓ {{ r.dropOffBookingRuleExternalId }}
                  </span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="calendar">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.flexStopTimes.colCalendar') }}</th>
              <td mat-cell *matCellDef="let r">
                @if (r.serviceCalendarExternalId) {
                  <span class="calendar-tag">{{ r.serviceCalendarExternalId }}</span>
                } @else {
                  <span class="calendar-tag muted">{{ t('admin.flexStopTimes.calendarAlways') }}</span>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </mat-card>
      }
    </div>
    </ng-container>
  `,
  styles: `
    .flex-page {
      max-width: 1200px;
    }

    .page-header {
      margin-bottom: 16px;
    }

    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--app-on-surface);
      margin: 0 0 6px;
    }

    .page-subtitle {
      color: var(--app-on-surface-muted);
      margin: 0;
    }

    .full-width { width: 100%; }
    .time-cell { font-variant-numeric: tabular-nums; }

    .line-badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 6px;
      color: white;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 16px;
    }

    .legend-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 500;
    }

    .legend-pill mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .pill-target-stop {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .pill-target-location {
      background: rgba(99, 102, 241, 0.16);
      color: #4338ca;
    }

    .pill-target-group {
      background: rgba(244, 114, 182, 0.16);
      color: #be185d;
    }

    .rule-tag {
      display: inline-block;
      padding: 2px 7px;
      margin-right: 4px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.14);
      color: #047857;
      font-size: 0.78rem;
    }

    /* Dark mode swap: the indigo/pink/green -700 shades stop hitting
     * WCAG AA against a dark translucent surface. Move to the -300
     * row and bump alpha for the background. */
    :host-context(.dark-theme) {
      .pill-target-location { background: rgba(99, 102, 241, 0.30); color: #a5b4fc; }
      .pill-target-group    { background: rgba(244, 114, 182, 0.30); color: #f9a8d4; }
      .rule-tag             { background: rgba(16, 185, 129, 0.26); color: #6ee7b7; }
    }

    .calendar-tag {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.78rem;
    }

    .calendar-tag.muted { font-style: italic; }
  `,
})
export class FlexStopTimesComponent implements OnInit {
  private readonly flexService = inject(FlexStopTimeService);
  private readonly transloco = inject(TranslocoService);

  readonly rows = signal<FlexStopTime[]>([]);
  readonly loadError = signal<string | null>(null);
  readonly columns = ['line', 'itinerary', 'target', 'window', 'bookings', 'calendar'];

  readonly count = computed(() => this.rows().length);

  ngOnInit(): void {
    this.loadRows();
  }

  loadRows(): void {
    this.loadError.set(null);
    this.flexService.browse().subscribe({
      next: (rows) => this.rows.set(rows),
      error: (err: unknown) => {
        this.rows.set([]);
        this.loadError.set(httpErrorMessage(err, this.transloco.translate('admin.flexStopTimes.loadFailed')));
      },
    });
  }

  formatTime(iso: string): string {
    return iso ? iso.slice(0, 5) : '';
  }
}
