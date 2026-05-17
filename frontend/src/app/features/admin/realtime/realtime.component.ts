import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotifyService } from '@core/services/notify.service';
import { RealtimeService } from '@core/api/realtime.service';
import { RealtimeAlert, VehiclePosition } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { httpErrorMessage } from '@shared/utils/http.utils';

/**
 * Admin browser for the GTFS-Realtime caches. Two tabs (alerts and
 * vehicles), each with a refresh button that forces an immediate
 * poll instead of waiting for the next scheduled tick. Read-only —
 * GTFS-RT data flows from the operator's feed, never the other way.
 *
 * Hidden surface: feeds without a configured URL (alerts-url /
 * vehicle-positions-url empty) return 400 from the refresh endpoint;
 * we surface that as a clear "not configured" message rather than
 * a generic error toast.
 */
@Component({
  selector: 'app-realtime',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './realtime.component.html',
  styleUrl: './realtime.component.scss',
})
export class RealtimeComponent {
  private readonly realtime = inject(RealtimeService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    this.loadAlerts();
    this.loadVehicles();
  }

  severityLabel(severity: string | null | undefined, t: (key: string) => string): string {
    switch (severity) {
      case 'CRITICAL': return t('admin.realtime.severityCritical');
      case 'WARNING': return t('admin.realtime.severityWarning');
      case 'INFO': return t('admin.realtime.severityInfo');
      default: return severity ?? '';
    }
  }

  readonly alerts = signal<RealtimeAlert[]>([]);
  readonly vehicles = signal<VehiclePosition[]>([]);
  readonly alertsLoadedAt = signal<Date | null>(null);
  readonly vehiclesLoadedAt = signal<Date | null>(null);
  readonly alertsLoadError = signal<string | null>(null);
  readonly vehiclesLoadError = signal<string | null>(null);
  readonly refreshingAlerts = signal(false);
  readonly refreshingVehicles = signal(false);

  readonly vehicleColumns = ['vehicle', 'route', 'trip', 'position', 'speed', 'status', 'occupancy', 'bearing', 'congestion', 'timestamp'];

  refreshAlerts(): void {
    this.refreshingAlerts.set(true);
    this.realtime.refreshAlerts().subscribe({
      next: (data) => {
        this.alerts.set(data);
        this.alertsLoadedAt.set(new Date());
        this.refreshingAlerts.set(false);
      },
      error: () => {
        this.refreshingAlerts.set(false);
        this.notify.info(this.transloco.translate('admin.realtime.alertsNotConfigured'));
      },
    });
  }

  refreshVehicles(): void {
    this.refreshingVehicles.set(true);
    this.realtime.refreshVehicles().subscribe({
      next: (data) => {
        this.vehicles.set(data);
        this.vehiclesLoadedAt.set(new Date());
        this.refreshingVehicles.set(false);
      },
      error: () => {
        this.refreshingVehicles.set(false);
        this.notify.info(this.transloco.translate('admin.realtime.vehiclesNotConfigured'));
      },
    });
  }

  occupancyLabel(v: VehiclePosition): string {
    if (v.occupancyStatus) {
      const pct = v.occupancyPercentage;
      return pct !== null ? `${v.occupancyStatus} (${pct}%)` : v.occupancyStatus;
    }
    return v.occupancyPercentage !== null ? `${v.occupancyPercentage}%` : '—';
  }

  /** Map GTFS-RT OccupancyStatus enum to a tone class used by the
   *  occupancy badge. EMPTY / MANY_SEATS_AVAILABLE → green, mid →
   *  amber, FULL / CRUSHED → red. */
  occupancyClass(v: VehiclePosition): string {
    const s = v.occupancyStatus ?? '';
    if (s === 'EMPTY' || s === 'MANY_SEATS_AVAILABLE') {return 'occ-low';}
    if (s === 'FEW_SEATS_AVAILABLE' || s === 'STANDING_ROOM_ONLY') {return 'occ-mid';}
    if (s === 'CRUSHED_STANDING_ROOM_ONLY' || s === 'FULL'
        || s === 'NOT_ACCEPTING_PASSENGERS') {return 'occ-high';}
    if (v.occupancyPercentage !== null) {
      if (v.occupancyPercentage >= 80) {return 'occ-high';}
      if (v.occupancyPercentage >= 40) {return 'occ-mid';}
      return 'occ-low';
    }
    return 'occ-unknown';
  }

  occupancyIcon(v: VehiclePosition): string {
    const cls = this.occupancyClass(v);
    if (cls === 'occ-low') {return 'sentiment_very_satisfied';}
    if (cls === 'occ-mid') {return 'sentiment_neutral';}
    if (cls === 'occ-high') {return 'sentiment_very_dissatisfied';}
    return 'help_outline';
  }

  occupancyShort(v: VehiclePosition, t: (key: string) => string): string {
    const cls = this.occupancyClass(v);
    if (cls === 'occ-low') {return t('admin.realtime.occupancy.available');}
    if (cls === 'occ-mid') {return t('admin.realtime.occupancy.crowded');}
    if (cls === 'occ-high') {return t('admin.realtime.occupancy.full');}
    return v.occupancyPercentage !== null ? `${v.occupancyPercentage}%` : '?';
  }

  occupancyTooltip(v: VehiclePosition): string {
    return this.occupancyLabel(v);
  }

  kmh(metresPerSecond: number): number {
    return metresPerSecond * 3.6;
  }

  loadAlerts(): void {
    this.alertsLoadError.set(null);
    this.realtime.getAlerts().subscribe({
      next: (data) => {
        this.alerts.set(data);
        this.alertsLoadedAt.set(new Date());
      },
      error: (err: unknown) => {
        this.alerts.set([]);
        this.alertsLoadError.set(httpErrorMessage(err, this.transloco.translate('admin.realtime.alertsLoadFailed')));
      },
    });
  }

  loadVehicles(): void {
    this.vehiclesLoadError.set(null);
    this.realtime.getVehicles().subscribe({
      next: (data) => {
        this.vehicles.set(data);
        this.vehiclesLoadedAt.set(new Date());
      },
      error: (err: unknown) => {
        this.vehicles.set([]);
        this.vehiclesLoadError.set(httpErrorMessage(err, this.transloco.translate('admin.realtime.vehiclesLoadFailed')));
      },
    });
  }
}
