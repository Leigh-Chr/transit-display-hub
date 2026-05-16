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
import { TranslocoDirective, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NetworkMapDataService } from '@features/network-map/services/network-map-data.service';
import { LocaleService } from '@core/i18n/locale.service';
import { NetworkLine, NetworkMap, NetworkStop } from '@shared/models';
import { bcp47 } from '@shared/utils/locale-date.utils';

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
    TranslocoDirective,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <div class="page">
      <header class="page-header">
        <a routerLink="/map" class="back-link" [attr.aria-label]="t('map.title')">
          <mat-icon>map</mat-icon>
          {{ t('map.title') }}
        </a>
        <h1 class="page-title">{{ t('map.title') }} — {{ t('map.viewList') }}</h1>
        <p class="page-subtitle">{{ t('map.viewListAria') }}</p>
      </header>

      <section class="controls" [attr.aria-label]="t('common.search')">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>{{ t('map.searchStop') }}</mat-label>
          <input matInput
                 type="search"
                 [ngModel]="search()"
                 (ngModelChange)="search.set($event)">
        </mat-form-field>
        <mat-checkbox [checked]="accessibleOnly()"
                      (change)="accessibleOnly.set($event.checked)">
          {{ t('map.filterAccessible') }}
        </mat-checkbox>
        <mat-checkbox [checked]="onDemandOnly()"
                      (change)="onDemandOnly.set($event.checked)">
          {{ t('map.filterOnDemand') }}
        </mat-checkbox>
      </section>

      @if (loading()) {
        <p class="muted" role="status" aria-live="polite">{{ t('map.loadingNetwork') }}</p>
      } @else if (data(); as map) {
        <section class="lines-section" aria-labelledby="lines-heading">
          <h2 id="lines-heading">{{ t('map.linesCount') }} ({{ map.lines.length }})</h2>
          <ul class="lines-list">
            @for (line of map.lines; track line.id) {
              <li class="line-item">
                <span class="line-badge"
                      [style.backgroundColor]="line.color"
                      [style.color]="line.textColor || '#fff'"
                      [attr.aria-label]="line.code + ' ' + line.name">
                  {{ line.code }}
                </span>
                <span class="line-name">{{ line.name }}</span>
                @if (line.type) {
                  <span class="line-type">{{ lineTypeLabel(line.type) }}</span>
                }
                @if (line.scheduleCount && line.scheduleCount > 0) {
                  <span class="line-count">
                    {{ formatCount(line.scheduleCount) }} {{ 'map.schedulesCount' | transloco }}
                  </span>
                }
              </li>
            }
          </ul>
        </section>

        <section class="stops-section" aria-labelledby="stops-heading">
          <h2 id="stops-heading">
            {{ t('map.stopsCount') }} ({{ filteredStops().length }} / {{ map.stops.length }})
          </h2>
          @if (filteredStops().length === 0) {
            <p class="muted">{{ t('map.noMatchingStops') }}</p>
          } @else {
            <table mat-table [dataSource]="filteredStops()" class="stops-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef scope="col">{{ 'map.columnName' | transloco }}</th>
                <td mat-cell *matCellDef="let stop">{{ stop.name }}</td>
              </ng-container>
              <ng-container matColumnDef="lines">
                <th mat-header-cell *matHeaderCellDef scope="col">{{ 'map.columnLines' | transloco }}</th>
                <td mat-cell *matCellDef="let stop">
                  @for (code of stop.lineCodes; track code) {
                    <span class="line-tag">{{ code }}</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="accessibility">
                <th mat-header-cell *matHeaderCellDef scope="col">{{ 'map.columnAccessibility' | transloco }}</th>
                <td mat-cell *matCellDef="let stop">
                  {{ accessibilityLabel(stop.wheelchairBoarding) }}
                </td>
              </ng-container>
              <ng-container matColumnDef="ondemand">
                <th mat-header-cell *matHeaderCellDef scope="col">{{ 'map.columnOnDemand' | transloco }}</th>
                <td mat-cell *matCellDef="let stop">
                  {{ stop.hasOnDemand ? t('common.yes') : t('common.no') }}
                </td>
              </ng-container>
              <ng-container matColumnDef="zones">
                <th mat-header-cell *matHeaderCellDef scope="col">{{ 'map.columnFareZones' | transloco }}</th>
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
        <p class="error" role="alert">{{ t('map.loadFailed') }}</p>
      }
    </div>
    </ng-container>
  `,
  styles: `
    .page { padding: 24px; max-width: 1300px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 8px 0 4px 0; font-size: var(--m3-type-headline-medium); font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .back-link {
      display: inline-flex; align-items: center; gap: 6px;
      text-decoration: none;
      color: var(--mat-sys-primary);
    }
    .back-link mat-icon { font-size: var(--m3-type-title-large); width: 18px; height: 18px; }

    .controls {
      display: flex; flex-wrap: wrap; gap: 16px; align-items: center;
      margin-bottom: 16px;
    }
    .search-field { min-width: 280px; }

    .muted { color: var(--mat-sys-on-surface-variant); }
    .error { color: var(--app-critical); }

    .lines-section, .stops-section {
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .lines-section h2, .stops-section h2 {
      margin: 0 0 12px 0;
      font-size: var(--m3-type-title-large);
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
    .line-type { color: var(--mat-sys-on-surface-variant); font-size: var(--m3-type-body-medium); }
    .line-count { color: var(--mat-sys-on-surface-variant); font-size: var(--m3-type-body-medium); }

    .stops-table { width: 100%; }
    .line-tag {
      display: inline-block;
      padding: 1px 6px;
      margin-right: 4px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-high);
      font-size: var(--m3-type-body-medium);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class NetworkListComponent implements OnInit {
  private readonly dataService = inject(NetworkMapDataService);
  private readonly transloco = inject(TranslocoService);
  private readonly locale = inject(LocaleService);

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
      case 'ACCESSIBLE': return this.transloco.translate('map.accessibility.accessible');
      case 'NOT_ACCESSIBLE': return this.transloco.translate('map.accessibility.notAccessible');
      case 'UNKNOWN':
      case undefined:
      case null: return this.transloco.translate('map.accessibility.unknown');
    }
  }

  lineTypeLabel(type: NonNullable<NetworkLine['type']>): string {
    // Resolve via the shared map.transit.lineType.* namespace so the same
    // catalogue (METRO -> "Metro" / "Subway", etc.) backs every page that
    // renders a GTFS route_type. Falls back to the raw enum if the dict
    // is missing the key (defensive against custom GTFS types).
    const key = `map.transit.lineType.${type}`;
    const translated = this.transloco.translate(key);
    return translated === key ? type : translated;
  }

  formatCount(value: number): string {
    const tag = bcp47(this.locale.current());
    if (value < 10_000) {return value.toLocaleString(tag);}
    return (value / 1000).toLocaleString(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k';
  }
}
