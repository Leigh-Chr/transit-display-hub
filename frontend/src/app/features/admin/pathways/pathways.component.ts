import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { StopService } from '@core/api/stop.service';
import { Pathway, PathwayMode, Stop } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

/**
 * Browse the indoor topology — pathways.txt — around any stop.
 *
 * The autocomplete narrows the list as the admin types: feed-level
 * stop counts get into the thousands, so picking from a static
 * dropdown isn't workable. Stops without ingoing/outgoing segments
 * legitimately render an empty state.
 */
@Component({
  selector: 'app-pathways',
  standalone: true,
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    MatTooltipModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pathways-page">
      <div class="page-header">
        <h1 class="page-title">Topologie indoor</h1>
        <p class="page-subtitle">
          Connexions piétonnes intra-station — escaliers, ascenseurs,
          sorties — depuis pathways.txt. Sélectionne un arrêt pour
          voir ses segments entrants et sortants.
        </p>
      </div>

      <mat-form-field appearance="outline" class="stop-picker">
        <mat-label>Arrêt</mat-label>
        <input
          type="text"
          matInput
          [(ngModel)]="search"
          (ngModelChange)="onSearchChange()"
          [matAutocomplete]="auto"
          placeholder="Tape le nom de l'arrêt…">
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onStopSelected($event.option.value)">
          @for (s of filteredStops(); track s.id) {
            <mat-option [value]="s">
              {{ s.name }}
              @if (s.platformCode) {
                <span class="platform">— quai {{ s.platformCode }}</span>
              }
            </mat-option>
          }
        </mat-autocomplete>
        <mat-icon matSuffix>place</mat-icon>
      </mat-form-field>

      @if (selectedStop(); as stop) {
        <div class="selected-stop">
          <h2>{{ stop.name }}</h2>
          @if (pathways().length === 0) {
            <app-empty-state
              icon="alt_route"
              title="Pas de pathway pour cet arrêt"
              description="Soit la station n'a pas de topologie indoor déclarée, soit l'arrêt est un poteau bus." />
          } @else {
            <div class="pathways-table-wrapper">
              <table mat-table [dataSource]="pathways()" class="pathways-table">
                <ng-container matColumnDef="mode">
                  <th mat-header-cell *matHeaderCellDef>Mode</th>
                  <td mat-cell *matCellDef="let p">
                    <mat-icon class="mode-icon" [matTooltip]="modeLabel(p.pathwayMode)">
                      {{ modeIcon(p.pathwayMode) }}
                    </mat-icon>
                  </td>
                </ng-container>

                <ng-container matColumnDef="from">
                  <th mat-header-cell *matHeaderCellDef>Depuis</th>
                  <td mat-cell *matCellDef="let p">
                    <strong [class.current]="p.fromStopId === selectedStop()?.id">
                      {{ p.fromStopName }}
                    </strong>
                  </td>
                </ng-container>

                <ng-container matColumnDef="direction">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let p">
                    <mat-icon class="direction-icon">
                      {{ p.bidirectional ? 'sync_alt' : 'arrow_forward' }}
                    </mat-icon>
                  </td>
                </ng-container>

                <ng-container matColumnDef="to">
                  <th mat-header-cell *matHeaderCellDef>Vers</th>
                  <td mat-cell *matCellDef="let p">
                    <strong [class.current]="p.toStopId === selectedStop()?.id">
                      {{ p.toStopName }}
                    </strong>
                  </td>
                </ng-container>

                <ng-container matColumnDef="signpost">
                  <th mat-header-cell *matHeaderCellDef>Signalétique</th>
                  <td mat-cell *matCellDef="let p">
                    @if (p.signpostedAs || p.reversedSignpostedAs) {
                      <span class="signpost">
                        @if (p.signpostedAs) { {{ p.signpostedAs }} }
                        @if (p.bidirectional && p.reversedSignpostedAs) {
                          <span class="muted"> / {{ p.reversedSignpostedAs }}</span>
                        }
                      </span>
                    } @else { — }
                  </td>
                </ng-container>

                <ng-container matColumnDef="length">
                  <th mat-header-cell *matHeaderCellDef>Distance</th>
                  <td mat-cell *matCellDef="let p">
                    {{ p.lengthMetres !== null ? (p.lengthMetres + ' m') : '—' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="time">
                  <th mat-header-cell *matHeaderCellDef>Durée</th>
                  <td mat-cell *matCellDef="let p">
                    {{ p.traversalTimeSeconds !== null ? (p.traversalTimeSeconds + ' s') : '—' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="details">
                  <th mat-header-cell *matHeaderCellDef>Détails</th>
                  <td mat-cell *matCellDef="let p" class="details-cell">
                    @if (p.stairCount) {
                      <span class="detail-chip"><mat-icon>stairs</mat-icon>{{ p.stairCount }}</span>
                    }
                    @if (p.maxSlope) {
                      <span class="detail-chip"><mat-icon>trending_up</mat-icon>{{ p.maxSlope }}</span>
                    }
                    @if (p.minWidthMetres) {
                      <span class="detail-chip"><mat-icon>width_full</mat-icon>{{ p.minWidthMetres }} m</span>
                    }
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let row; columns: columns"></tr>
              </table>
            </div>
          }
        </div>
      } @else {
        <app-empty-state
          icon="search"
          title="Sélectionne un arrêt"
          description="Tape un nom dans le champ ci-dessus pour voir les pathways autour d'une station." />
      }
    </div>
  `,
  styles: `
    .pathways-page { max-width: 1300px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: 1.6rem; font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .stop-picker { width: 100%; max-width: 480px; margin-bottom: 24px; }
    .platform { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; margin-left: 4px; }

    .selected-stop h2 {
      margin: 0 0 16px 0;
      font-size: 1.2rem;
      font-weight: 600;
    }

    .pathways-table-wrapper {
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      overflow-x: auto;
    }
    .pathways-table { width: 100%; }
    .pathways-table td, .pathways-table th { font-variant-numeric: tabular-nums; }

    .mode-icon { color: var(--mat-sys-primary); }
    .direction-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--mat-sys-on-surface-variant);
    }
    .current { color: var(--mat-sys-primary); }
    .signpost { font-style: italic; }
    .muted { color: var(--mat-sys-on-surface-variant); }

    .details-cell {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .detail-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 8px;
      background: var(--mat-sys-surface-container-high);
      border-radius: 999px;
      font-size: 0.78rem;
    }
    .detail-chip mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }
  `,
})
export class PathwaysComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);
  private readonly stopService = inject(StopService);

  readonly pathways = signal<Pathway[]>([]);
  readonly selectedStop = signal<Stop | null>(null);
  readonly stops = signal<Stop[]>([]);
  readonly filteredStops = signal<Stop[]>([]);

  search = '';

  readonly columns = ['mode', 'from', 'direction', 'to', 'signpost', 'length', 'time', 'details'];

  ngOnInit(): void {
    this.stopService.getAll().subscribe({
      next: (data) => {
        this.stops.set(data);
        this.filteredStops.set(data.slice(0, 30));
      },
      error: () => this.stops.set([]),
    });
  }

  onSearchChange(): void {
    if (typeof this.search === 'object') {return;} // autocomplete passes the object
    const q = this.search.toLowerCase().trim();
    if (!q) {
      this.filteredStops.set(this.stops().slice(0, 30));
      return;
    }
    this.filteredStops.set(
      this.stops()
        .filter(s => s.name.toLowerCase().includes(q))
        .slice(0, 30)
    );
  }

  onStopSelected(stop: Stop): void {
    this.selectedStop.set(stop);
    this.search = stop.name;
    this.gtfsData.getPathwaysForStop(stop.id).subscribe({
      next: (data) => this.pathways.set(data),
      error: () => this.pathways.set([]),
    });
  }

  modeIcon(mode: PathwayMode): string {
    switch (mode) {
      case 'WALKWAY': return 'directions_walk';
      case 'STAIRS': return 'stairs';
      case 'MOVING_SIDEWALK': return 'commit';
      case 'ESCALATOR': return 'escalator';
      case 'ELEVATOR': return 'elevator';
      case 'FARE_GATE': return 'lock';
      case 'EXIT_GATE': return 'logout';
    }
  }

  modeLabel(mode: PathwayMode): string {
    switch (mode) {
      case 'WALKWAY': return 'Couloir';
      case 'STAIRS': return 'Escalier';
      case 'MOVING_SIDEWALK': return 'Tapis roulant';
      case 'ESCALATOR': return 'Escalator';
      case 'ELEVATOR': return 'Ascenseur';
      case 'FARE_GATE': return 'Portillon (entrée)';
      case 'EXIT_GATE': return 'Portillon (sortie)';
    }
  }
}
