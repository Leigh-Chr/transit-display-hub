import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RealtimeService } from '@core/api/realtime.service';
import { RealtimeAlert, VehiclePosition } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="realtime-page">
      <div class="page-header">
        <h1 class="page-title">Temps réel</h1>
        <p class="page-subtitle">
          Caches GTFS-Realtime alimentés par le scheduler.
          Le bouton "Rafraîchir" force un poll immédiat de l'URL configurée.
        </p>
      </div>

      <mat-tab-group animationDuration="0ms">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">campaign</mat-icon>
            Alertes
            <span class="tab-count">{{ alerts().length }}</span>
          </ng-template>

          <div class="tab-content">
            <div class="tab-toolbar">
              <button mat-stroked-button (click)="refreshAlerts()" [disabled]="refreshingAlerts()">
                <mat-icon>refresh</mat-icon>
                Rafraîchir
              </button>
              @if (alertsLoadedAt(); as t) {
                <span class="muted">Dernière lecture {{ t | date:'HH:mm:ss' }}</span>
              }
            </div>

            @if (alerts().length === 0) {
              <app-empty-state
                icon="cloud_off"
                title="Aucune alerte active"
                description="Le cache GTFS-RT alerts est vide. Soit aucune alerte n'est en vigueur, soit l'URL n'est pas configurée." />
            } @else {
              <div class="alert-grid">
                @for (alert of alerts(); track alert.id) {
                  <mat-card class="alert-card" [class.severity-critical]="alert.severity === 'CRITICAL'"
                                              [class.severity-warning]="alert.severity === 'WARNING'">
                    <mat-card-content>
                      <div class="alert-head">
                        @if (alert.severity) {
                          <mat-chip class="severity-chip">{{ alert.severity }}</mat-chip>
                        }
                        @if (alert.effect) {
                          <span class="muted">{{ alert.effect }}</span>
                        }
                      </div>
                      <h3 class="alert-title">{{ alert.headerText || alert.id }}</h3>
                      @if (alert.descriptionText) {
                        <p class="alert-body">{{ alert.descriptionText }}</p>
                      }
                      <div class="alert-scope">
                        @if (alert.routeIds.length > 0) {
                          <span class="scope-pill">
                            <mat-icon>subway</mat-icon>
                            {{ alert.routeIds.join(', ') }}
                          </span>
                        }
                        @if (alert.stopIds.length > 0) {
                          <span class="scope-pill">
                            <mat-icon>place</mat-icon>
                            {{ alert.stopIds.join(', ') }}
                          </span>
                        }
                        @if (alert.agencyIds.length > 0) {
                          <span class="scope-pill">
                            <mat-icon>business</mat-icon>
                            {{ alert.agencyIds.join(', ') }}
                          </span>
                        }
                      </div>
                      @if (alert.url) {
                        <a [href]="alert.url" target="_blank" rel="noopener" class="alert-link">
                          Plus d'info
                          <mat-icon>open_in_new</mat-icon>
                        </a>
                      }
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            }
          </div>
        </mat-tab>

        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">directions_bus</mat-icon>
            Véhicules
            <span class="tab-count">{{ vehicles().length }}</span>
          </ng-template>

          <div class="tab-content">
            <div class="tab-toolbar">
              <button mat-stroked-button (click)="refreshVehicles()" [disabled]="refreshingVehicles()">
                <mat-icon>refresh</mat-icon>
                Rafraîchir
              </button>
              @if (vehiclesLoadedAt(); as t) {
                <span class="muted">Dernière lecture {{ t | date:'HH:mm:ss' }}</span>
              }
            </div>

            @if (vehicles().length === 0) {
              <app-empty-state
                icon="cloud_off"
                title="Aucun véhicule rapporté"
                description="Le cache GTFS-RT vehicles est vide. Le poll suivant rafraîchira la liste." />
            } @else {
              <div class="vehicle-table-wrapper">
                <table mat-table [dataSource]="vehicles()" class="vehicle-table">
                  <ng-container matColumnDef="vehicle">
                    <th mat-header-cell *matHeaderCellDef>Véhicule</th>
                    <td mat-cell *matCellDef="let v">
                      <strong>{{ v.vehicleLabel || v.vehicleId || v.entityId }}</strong>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="route">
                    <th mat-header-cell *matHeaderCellDef>Ligne</th>
                    <td mat-cell *matCellDef="let v">{{ v.routeId || '—' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="trip">
                    <th mat-header-cell *matHeaderCellDef>Trip</th>
                    <td mat-cell *matCellDef="let v">{{ v.tripId || '—' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="position">
                    <th mat-header-cell *matHeaderCellDef>Position</th>
                    <td mat-cell *matCellDef="let v">
                      @if (v.latitude !== null && v.longitude !== null) {
                        {{ v.latitude | number:'1.4-4' }}, {{ v.longitude | number:'1.4-4' }}
                      } @else {
                        —
                      }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="speed">
                    <th mat-header-cell *matHeaderCellDef>Vitesse</th>
                    <td mat-cell *matCellDef="let v">
                      @if (v.speedMetresPerSecond !== null) {
                        {{ kmh(v.speedMetresPerSecond) | number:'1.0-0' }} km/h
                      } @else {
                        —
                      }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Statut</th>
                    <td mat-cell *matCellDef="let v">{{ v.currentStatus || '—' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="occupancy">
                    <th mat-header-cell *matHeaderCellDef>Occupation</th>
                    <td mat-cell *matCellDef="let v">
                      @if (v.occupancyStatus || v.occupancyPercentage !== null) {
                        <span class="occupancy-badge" [class]="occupancyClass(v)" [matTooltip]="occupancyTooltip(v)">
                          <mat-icon>{{ occupancyIcon(v) }}</mat-icon>
                          {{ occupancyShort(v) }}
                        </span>
                      } @else {
                        —
                      }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="bearing">
                    <th mat-header-cell *matHeaderCellDef>Cap</th>
                    <td mat-cell *matCellDef="let v">
                      @if (v.bearing !== null) {
                        <span class="bearing-arrow" [style.transform]="'rotate(' + v.bearing + 'deg)'" [matTooltip]="v.bearing + '°'">
                          <mat-icon>navigation</mat-icon>
                        </span>
                      } @else { — }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="congestion">
                    <th mat-header-cell *matHeaderCellDef>Congestion</th>
                    <td mat-cell *matCellDef="let v">
                      @if (v.congestionLevel) {
                        <span class="congestion-pill">{{ v.congestionLevel }}</span>
                      } @else { — }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="timestamp">
                    <th mat-header-cell *matHeaderCellDef>Émis</th>
                    <td mat-cell *matCellDef="let v">
                      @if (v.timestampEpochSeconds !== null) {
                        {{ (v.timestampEpochSeconds * 1000) | date:'HH:mm:ss' }}
                      } @else {
                        —
                      }
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="vehicleColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: vehicleColumns"></tr>
                </table>
              </div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: `
    .realtime-page { max-width: 1200px; }
    .occupancy-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 500;
    }
    .occupancy-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .occ-low { background: rgba(16, 185, 129, 0.16); color: #047857; }
    .occ-mid { background: rgba(234, 179, 8, 0.18); color: #92400e; }
    .occ-high { background: rgba(239, 68, 68, 0.18); color: #b91c1c; }
    .occ-unknown { background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface-variant); }
    .bearing-arrow { display: inline-block; transform-origin: center; }
    .bearing-arrow mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .congestion-pill {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: 1.6rem; font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .tab-icon { margin-right: 6px; vertical-align: middle; }
    .tab-count {
      margin-left: 8px;
      font-size: 0.75rem;
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font-variant-numeric: tabular-nums;
    }

    .tab-content { padding: 16px 0; }
    .tab-toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .muted { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; }

    .alert-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 12px;
    }
    .alert-card { border-left: 3px solid var(--mat-sys-outline-variant); }
    .alert-card.severity-warning { border-left-color: rgb(241, 158, 11); }
    .alert-card.severity-critical { border-left-color: rgb(220, 38, 38); }

    .alert-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .severity-chip {
      font-size: 0.7rem;
      letter-spacing: 0.06em;
      font-weight: 600;
    }
    .alert-title { margin: 0 0 6px 0; font-size: 1rem; font-weight: 600; }
    .alert-body { margin: 0 0 10px 0; font-size: 0.9rem; line-height: 1.4; }

    .alert-scope {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .scope-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      background: var(--mat-sys-surface-container-high);
      border-radius: 999px;
      font-size: 0.78rem;
    }
    .scope-pill mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .alert-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 12px;
      font-size: 0.85rem;
      color: var(--mat-sys-primary);
      text-decoration: none;
    }
    .alert-link mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .alert-link:hover { text-decoration: underline; }

    .vehicle-table-wrapper {
      overflow-x: auto;
      border-radius: 8px;
      background: var(--mat-sys-surface-container);
    }
    .vehicle-table { width: 100%; }
    .vehicle-table td, .vehicle-table th {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class RealtimeComponent implements OnInit {
  private readonly realtime = inject(RealtimeService);
  private readonly snackBar = inject(MatSnackBar);

  readonly alerts = signal<RealtimeAlert[]>([]);
  readonly vehicles = signal<VehiclePosition[]>([]);
  readonly alertsLoadedAt = signal<Date | null>(null);
  readonly vehiclesLoadedAt = signal<Date | null>(null);
  readonly refreshingAlerts = signal(false);
  readonly refreshingVehicles = signal(false);

  readonly vehicleColumns = ['vehicle', 'route', 'trip', 'position', 'speed', 'status', 'occupancy', 'bearing', 'congestion', 'timestamp'];

  ngOnInit(): void {
    this.loadAlerts();
    this.loadVehicles();
  }

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
        this.snackBar.open('Flux alertes non configuré (app.gtfs-rt.alerts-url vide)', 'OK', {duration: 4000});
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
        this.snackBar.open('Flux véhicules non configuré (app.gtfs-rt.vehicle-positions-url vide)', 'OK', {duration: 4000});
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

  occupancyShort(v: VehiclePosition): string {
    const cls = this.occupancyClass(v);
    if (cls === 'occ-low') {return 'Disponible';}
    if (cls === 'occ-mid') {return 'Bondé';}
    if (cls === 'occ-high') {return 'Plein';}
    return v.occupancyPercentage !== null ? `${v.occupancyPercentage}%` : '?';
  }

  occupancyTooltip(v: VehiclePosition): string {
    return this.occupancyLabel(v);
  }

  kmh(metresPerSecond: number): number {
    return metresPerSecond * 3.6;
  }

  private loadAlerts(): void {
    this.realtime.getAlerts().subscribe({
      next: (data) => {
        this.alerts.set(data);
        this.alertsLoadedAt.set(new Date());
      },
      error: () => {/* swallow — empty state covers it */},
    });
  }

  private loadVehicles(): void {
    this.realtime.getVehicles().subscribe({
      next: (data) => {
        this.vehicles.set(data);
        this.vehiclesLoadedAt.set(new Date());
      },
      error: () => {/* swallow */},
    });
  }
}
