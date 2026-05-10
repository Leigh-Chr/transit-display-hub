import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { FlexLocation } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  FlatRing,
  buildViewport,
  colorForFeature,
  ringToSvgPath,
  ringsFromLocation,
} from '@shared/utils/flex-locations.utils';

interface RenderedRing {
  ring: FlatRing;
  path: string;
  fill: string;
}

/**
 * Admin overview of every GTFS-flex {@code locations.geojson} polygon
 * — the demand-responsive transit zones the importer just persisted.
 *
 * Equirectangular projection with a constant viewBox; all polygons go
 * on the same canvas so admins can see at a glance whether two zones
 * overlap or are stranded miles from any stop. Holes inside polygons
 * (interior rings per the GeoJSON spec) are rendered with the
 * {@code evenodd} fill rule so they show through correctly.
 *
 * Why no Leaflet / tile map: same trade-off as the shapes preview
 * (see {@code shapes.component.ts}). This page is a verification
 * surface, not a passenger-facing trip planner — pan/zoom and base
 * tiles aren't worth the dependency footprint.
 */
@Component({
  selector: 'app-tad-zones',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <div class="tad-zones-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.tadZones.title') }}</h1>
        <p class="page-subtitle">{{ t('admin.tadZones.subtitle') }}</p>
      </div>

      @if (loading()) {
        <div class="loading">{{ t('admin.tadZones.loading') }}</div>
      } @else if (locations().length === 0) {
        <app-empty-state
          icon="layers_clear"
          [title]="t('admin.tadZones.noZones')"
          [description]="t('admin.tadZones.noZonesDesc')" />
      } @else {
        <div class="layout">
          <mat-card class="map-card">
            <mat-card-content>
              <svg
                [attr.viewBox]="viewBox()"
                preserveAspectRatio="xMidYMid meet"
                class="zones-canvas"
                role="img"
                [attr.aria-label]="t('admin.tadZones.mapAria')">
                @for (rendered of renderedRings(); track $index) {
                  <path
                    [attr.d]="rendered.path"
                    [attr.fill]="rendered.fill"
                    [attr.fill-opacity]="opacityFor(rendered.ring.featureIndex)"
                    [attr.stroke]="strokeFor(rendered.ring.featureIndex)"
                    stroke-width="1.5"
                    fill-rule="evenodd"
                    vector-effect="non-scaling-stroke"
                    class="zone-path"
                    [class.zone-selected]="rendered.ring.featureIndex === selectedIndex()"
                    (click)="onPolygonClick(rendered.ring.featureIndex)"
                    (mouseenter)="hoveredIndex.set(rendered.ring.featureIndex)"
                    (mouseleave)="hoveredIndex.set(null)" />
                }
              </svg>
              <p class="map-footnote">{{ t('admin.tadZones.mapFootnote') }}</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="list-card">
            <mat-card-content>
              <h2 class="list-title">{{ t('admin.tadZones.zoneCount', { count: locations().length }) }}</h2>
              <ul class="zone-list" role="list">
                @for (loc of locations(); track loc.id; let idx = $index) {
                  <li>
                    <button
                      type="button"
                      class="zone-item"
                      [class.zone-item-selected]="idx === selectedIndex()"
                      (click)="onPolygonClick(idx)"
                      (mouseenter)="hoveredIndex.set(idx)"
                      (mouseleave)="hoveredIndex.set(null)">
                      <span class="zone-swatch" [style.background]="colorFor(idx)"></span>
                      <span class="zone-meta">
                        <strong>{{ loc.name || loc.externalId }}</strong>
                        <span class="zone-id">{{ loc.externalId }}</span>
                        @if (loc.stopExternalId) {
                          <span class="zone-stop"
                                [matTooltip]="t('admin.tadZones.stopTooltip')">
                            <mat-icon>place</mat-icon>{{ loc.stopExternalId }}
                          </span>
                        }
                        <span class="zone-type">{{ loc.geometryType }}</span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </mat-card-content>
          </mat-card>
        </div>
      }
    </div>
    </ng-container>
  `,
  styles: `
    .tad-zones-page { max-width: 1400px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: 1.6rem; font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .loading {
      padding: 48px 16px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
      gap: 16px;
    }
    @media (max-width: 1024px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }

    .zones-canvas {
      display: block;
      width: 100%;
      height: 540px;
      background: var(--mat-sys-surface-container-low);
      border-radius: 8px;
    }

    .zone-path {
      cursor: pointer;
      transition: fill-opacity 120ms ease, stroke-width 120ms ease;
    }
    .zone-path:hover { fill-opacity: 0.6; }
    .zone-selected {
      stroke-width: 3 !important;
      filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.25));
    }

    .map-footnote {
      margin: 12px 0 0;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .list-title {
      margin: 0 0 12px 0;
      font-size: 1rem;
      font-weight: 600;
    }
    .zone-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 540px;
      overflow-y: auto;
    }
    .zone-item {
      width: 100%;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 10px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .zone-item:hover {
      background: var(--mat-sys-surface-container-high);
    }
    .zone-item-selected {
      background: var(--mat-sys-secondary-container);
      border-color: var(--mat-sys-secondary);
    }
    .zone-swatch {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      border-radius: 3px;
      margin-top: 3px;
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .zone-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .zone-meta strong {
      font-size: 0.92rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .zone-id {
      font-size: 0.75rem;
      font-family: var(--mat-sys-code-font, monospace);
      color: var(--mat-sys-on-surface-variant);
    }
    .zone-stop {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.78rem;
      color: var(--mat-sys-primary);
    }
    .zone-stop mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .zone-type {
      font-size: 0.72rem;
      color: var(--mat-sys-on-surface-variant);
      font-style: italic;
    }
  `,
})
export class TadZonesComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);

  readonly locations = signal<FlexLocation[]>([]);
  readonly loading = signal(true);
  readonly selectedIndex = signal<number | null>(null);
  readonly hoveredIndex = signal<number | null>(null);

  /** Per-feature ring lists, exploded once per location list refresh.
   *  Stays in computed so the heavy GeoJSON parse doesn't happen on
   *  every hover/select change. */
  private readonly rings = computed<FlatRing[]>(() => {
    const out: FlatRing[] = [];
    const locs = this.locations();
    for (let i = 0; i < locs.length; i++) {
      const loc = locs[i];
      if (!loc) {continue;}
      out.push(...ringsFromLocation(loc, i));
    }
    return out;
  });

  private readonly viewport = computed(() => buildViewport(this.locations()));

  readonly viewBox = computed(() => this.viewport().viewBox);

  readonly renderedRings = computed<RenderedRing[]>(() => {
    const project = this.viewport().project;
    return this.rings().map(ring => ({
      ring,
      path: ringToSvgPath(ring, project),
      fill: colorForFeature(ring.featureIndex),
    }));
  });

  ngOnInit(): void {
    this.gtfsData.getFlexLocations().subscribe({
      next: (data) => {
        this.locations.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.locations.set([]);
        this.loading.set(false);
      },
    });
  }

  onPolygonClick(featureIndex: number): void {
    this.selectedIndex.set(this.selectedIndex() === featureIndex ? null : featureIndex);
  }

  /** Halo opacity: highlighted feature pops, others fade slightly so
   *  the click target stays unambiguous on overlapping zones. */
  opacityFor(featureIndex: number): number {
    const selected = this.selectedIndex();
    const hovered = this.hoveredIndex();
    if (selected !== null) {
      return selected === featureIndex ? 0.55 : 0.18;
    }
    if (hovered !== null && hovered !== featureIndex) {
      return 0.25;
    }
    return 0.4;
  }

  /** Stroke colour: same hue as the fill so the polygon reads as one
   *  visual unit, but slightly darker via lower lightness. */
  strokeFor(featureIndex: number): string {
    const hue = (featureIndex * 137.508) % 360;
    return `hsl(${hue.toFixed(0)}, 55%, 35%)`;
  }

  colorFor(featureIndex: number): string {
    return colorForFeature(featureIndex);
  }
}
