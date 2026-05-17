import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { FlexLocation } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { httpErrorMessage } from '@shared/utils/http.utils';
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
  templateUrl: './tad-zones.component.html',
  styleUrl: './tad-zones.component.scss',
})
export class TadZonesComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);
  private readonly transloco = inject(TranslocoService);

  readonly locations = signal<FlexLocation[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
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
    this.loadZones();
  }

  loadZones(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.gtfsData.getFlexLocations().subscribe({
      next: (data) => {
        this.locations.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.locations.set([]);
        this.loading.set(false);
        this.loadError.set(httpErrorMessage(err, this.transloco.translate('admin.tadZones.loadFailed')));
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
