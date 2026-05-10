import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { NetworkMapDataService } from '@features/network-map/services/network-map-data.service';
import { NetworkLine, NetworkMap, NetworkStop } from '@shared/models';

/**
 * Tabular alternative to the SVG schematic at {@code /map}. Ships the
 * exact same data — every line, every stop, every accessibility tag —
 * in a structure that screen readers and keyboard-only users can
 * navigate without ever touching the SVG itself.
 *
 * Three controls drive the table: a search box matching stop name
 * substring, a "wheelchair-accessible only" toggle that mirrors the
 * map's PMR filter, and a "show only on-demand stops" toggle for
 * users planning a TAD trip. Filters are independent and combine
 * with AND semantics.
 */
@Component({
  selector: 'app-network-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <a routerLink="/map" class="back-link" aria-label="Revenir au plan schématique">
          <mat-icon>map</mat-icon>
          Plan visuel
        </a>
        <h1 class="page-title">Réseau — vue tabulaire</h1>
        <p class="page-subtitle">
          Alternative accessible au plan schématique : navigation au
          clavier (Tab / flèches), lecteur d'écran compatible.
          Toutes les lignes et tous les arrêts y figurent.
        </p>
      </header>

      <section class="controls" aria-label="Filtres">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Filtrer par nom d'arrêt</mat-label>
          <input matInput
                 type="search"
                 [ngModel]="search()"
                 (ngModelChange)="search.set($event)"
                 placeholder="ex. Centrale">
        </mat-form-field>
        <mat-checkbox [checked]="accessibleOnly()"
                      (change)="accessibleOnly.set($event.checked)">
          Arrêts accessibles PMR uniquement
        </mat-checkbox>
        <mat-checkbox [checked]="onDemandOnly()"
                      (change)="onDemandOnly.set($event.checked)">
          Arrêts à la demande (TAD) uniquement
        </mat-checkbox>
      </section>

      @if (loading()) {
        <p class="muted" role="status" aria-live="polite">Chargement du réseau…</p>
      } @else if (data(); as map) {
        <section class="lines-section" aria-labelledby="lines-heading">
          <h2 id="lines-heading">Lignes ({{ map.lines.length }})</h2>
          <ul class="lines-list">
            @for (line of map.lines; track line.id) {
              <li class="line-item">
                <span class="line-badge"
                      [style.backgroundColor]="line.color"
                      [style.color]="line.textColor || '#fff'"
                      [attr.aria-label]="'Ligne ' + line.code + ' ' + line.name">
                  {{ line.code }}
                </span>
                <span class="line-name">{{ line.name }}</span>
                @if (line.type) {
                  <span class="line-type">{{ lineTypeLabel(line.type) }}</span>
                }
                @if (line.scheduleCount && line.scheduleCount > 0) {
                  <span class="line-count" [attr.aria-label]="line.scheduleCount + ' horaires'">
                    {{ formatCount(line.scheduleCount) }} horaires
                  </span>
                }
              </li>
            }
          </ul>
        </section>

        <section class="stops-section" aria-labelledby="stops-heading">
          <h2 id="stops-heading">
            Arrêts ({{ filteredStops().length }} sur {{ map.stops.length }})
          </h2>
          @if (filteredStops().length === 0) {
            <p class="muted">Aucun arrêt ne correspond aux filtres actifs.</p>
          } @else {
            <table mat-table [dataSource]="filteredStops()" class="stops-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef scope="col">Nom</th>
                <td mat-cell *matCellDef="let stop">{{ stop.name }}</td>
              </ng-container>
              <ng-container matColumnDef="lines">
                <th mat-header-cell *matHeaderCellDef scope="col">Lignes</th>
                <td mat-cell *matCellDef="let stop">
                  @for (code of stop.lineCodes; track code) {
                    <span class="line-tag"
                          [attr.aria-label]="'Ligne ' + code">{{ code }}</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="accessibility">
                <th mat-header-cell *matHeaderCellDef scope="col">Accessibilité</th>
                <td mat-cell *matCellDef="let stop">
                  {{ accessibilityLabel(stop.wheelchairBoarding) }}
                </td>
              </ng-container>
              <ng-container matColumnDef="ondemand">
                <th mat-header-cell *matHeaderCellDef scope="col">À la demande</th>
                <td mat-cell *matCellDef="let stop">
                  {{ stop.hasOnDemand ? 'Oui' : 'Non' }}
                </td>
              </ng-container>
              <ng-container matColumnDef="zones">
                <th mat-header-cell *matHeaderCellDef scope="col">Zones tarifaires</th>
                <td mat-cell *matCellDef="let stop">
                  {{ stop.fareAreaNames?.join(', ') || '—' }}
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          }
        </section>
      } @else {
        <p class="error" role="alert">
          Impossible de charger le réseau. Réessayez plus tard.
        </p>
      }
    </div>
  `,
  styles: `
    .page { padding: 24px; max-width: 1300px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 8px 0 4px 0; font-size: 1.6rem; font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .back-link {
      display: inline-flex; align-items: center; gap: 6px;
      text-decoration: none;
      color: var(--mat-sys-primary);
    }
    .back-link mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .controls {
      display: flex; flex-wrap: wrap; gap: 16px; align-items: center;
      margin-bottom: 16px;
    }
    .search-field { min-width: 280px; }

    .muted { color: var(--mat-sys-on-surface-variant); }
    .error { color: rgb(220, 38, 38); }

    .lines-section, .stops-section {
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .lines-section h2, .stops-section h2 {
      margin: 0 0 12px 0;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .lines-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .line-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--mat-sys-surface-container-high);
      border-radius: 8px;
    }
    .line-badge {
      display: inline-block;
      min-width: 32px;
      padding: 2px 8px;
      text-align: center;
      font-weight: 700;
      border-radius: 4px;
    }
    .line-name { font-weight: 500; }
    .line-type { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; }
    .line-count { color: var(--mat-sys-on-surface-variant); font-size: 0.85rem; }

    .stops-table { width: 100%; }
    .line-tag {
      display: inline-block;
      padding: 1px 6px;
      margin-right: 4px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-high);
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class NetworkListComponent implements OnInit {
  private readonly dataService = inject(NetworkMapDataService);

  readonly data = signal<NetworkMap | null>(null);
  readonly loading = signal<boolean>(true);
  readonly search = signal<string>('');
  readonly accessibleOnly = signal<boolean>(false);
  readonly onDemandOnly = signal<boolean>(false);

  readonly columns = ['name', 'lines', 'accessibility', 'ondemand', 'zones'];

  readonly filteredStops = computed<NetworkStop[]>(() => {
    const map = this.data();
    if (!map) {return [];}
    const needle = this.search().trim().toLowerCase();
    const accessible = this.accessibleOnly();
    const onDemand = this.onDemandOnly();
    return map.stops.filter((stop) => {
      if (needle && !stop.name.toLowerCase().includes(needle)) {return false;}
      if (accessible && stop.wheelchairBoarding !== 'ACCESSIBLE') {return false;}
      if (onDemand && !stop.hasOnDemand) {return false;}
      return true;
    });
  });

  ngOnInit(): void {
    this.dataService.getNetworkMap().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.data.set(null);
        this.loading.set(false);
      },
    });
  }

  accessibilityLabel(value: NetworkStop['wheelchairBoarding']): string {
    switch (value) {
      case 'ACCESSIBLE': return 'Accessible PMR';
      case 'NOT_ACCESSIBLE': return 'Non accessible';
      case 'UNKNOWN':
      case undefined:
      case null: return 'Non renseigné';
    }
  }

  lineTypeLabel(type: NonNullable<NetworkLine['type']>): string {
    const labels: Record<string, string> = {
      METRO: 'Métro',
      BUS: 'Bus',
      TRAM: 'Tramway',
      TRAIN: 'Train',
      FERRY: 'Bateau',
      FUNICULAR: 'Funiculaire',
      CABLE_CAR: 'Téléphérique',
      TROLLEYBUS: 'Trolley',
      MONORAIL: 'Monorail',
    };
    return labels[type] ?? type;
  }

  formatCount(value: number): string {
    if (value < 10_000) {return value.toLocaleString('fr-FR');}
    return (value / 1000).toFixed(1).replace('.', ',') + 'k';
  }
}
