import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { ItineraryService } from '@core/api/itinerary.service';
import { Itinerary, Shape, ShapePoint } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { lineTextColor, readableTextColor } from '@shared/utils/color.utils';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { httpErrorMessage } from '@shared/utils/http.utils';

interface ProjectedPoint { x: number; y: number; }

/**
 * Read-only SVG preview of an itinerary's shapes.txt polyline.
 *
 * The component projects {lat, lon} into a fixed viewport via
 * equirectangular projection, fitting the bounds with a 8 % margin so
 * the line never touches the box edges. Plate carrée is good enough
 * here — we're rendering a single line at city scale, not a world map.
 *
 * Why not Leaflet: this page exists precisely to surface shapes
 * without committing to a tile-based map renderer (which would be a
 * dedicated session of its own). The trade-off: no panning, no zoom,
 * no base tiles. Acceptable for an admin verification surface.
 */
@Component({
  selector: 'app-shapes',
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
    MatTooltipModule,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shapes.component.html',
  styleUrl: './shapes.component.scss',
})
export class ShapesComponent {
  private readonly gtfsData = inject(GtfsDataService);
  private readonly itineraryService = inject(ItineraryService);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    this.itineraryService.getAll().subscribe({
      next: (data) => {
        this.itineraries.set(data);
        this.filteredItins.set(data.slice(0, 30));
      },
      error: () => this.itineraries.set([]),
    });
  }

  private static readonly VIEW_W = 800;
  private static readonly VIEW_H = 480;
  private static readonly MARGIN = 0.08;

  readonly itineraries = signal<Itinerary[]>([]);
  readonly filteredItins = signal<Itinerary[]>([]);
  readonly selectedItin = signal<Itinerary | null>(null);
  readonly shape = signal<Shape | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  search = '';

  readonly projectedPoints = computed<ProjectedPoint[]>(() => {
    const s = this.shape();
    if (!s || s.points.length === 0) {return [];}
    return this.project(s.points);
  });

  readonly polylinePoints = computed<string>(() =>
    this.projectedPoints().map(p => `${p.x},${p.y}`).join(' ')
  );

  readonly viewBox = computed<string>(() =>
    `0 0 ${ShapesComponent.VIEW_W} ${ShapesComponent.VIEW_H}`
  );

  readonly firstPoint = computed<ProjectedPoint | null>(() => {
    const pts = this.projectedPoints();
    return pts.length > 0 ? pts[0] ?? null : null;
  });

  readonly lastPoint = computed<ProjectedPoint | null>(() => {
    const pts = this.projectedPoints();
    return pts.length > 0 ? pts[pts.length - 1] ?? null : null;
  });

  readonly totalDistanceKm = computed<number | null>(() => {
    const s = this.shape();
    if (!s || s.points.length === 0) {return null;}
    const last = s.points[s.points.length - 1]?.distTraveled;
    if (last === null || last === undefined) {return null;}
    // GTFS doesn't pin distTraveled units; the convention "metres" works
    // for most agencies but some publish km already. Anything over 10 000
    // is almost certainly metres on a single trip.
    return last > 10_000 ? last / 1000 : last;
  });

  onSearchChange(): void {
    if (typeof this.search === 'object') {return;}
    const q = this.search.toLowerCase().trim();
    if (!q) {
      this.filteredItins.set(this.itineraries().slice(0, 30));
      return;
    }
    this.filteredItins.set(
      this.itineraries()
        .filter(it =>
          it.name.toLowerCase().includes(q) ||
          it.line.code.toLowerCase().includes(q) ||
          it.line.name.toLowerCase().includes(q))
        .slice(0, 30)
    );
  }

  onItinSelected(itin: Itinerary): void {
    this.selectedItin.set(itin);
    this.search = itin.name;
    this.loadShape();
  }

  loadShape(): void {
    const itin = this.selectedItin();
    if (!itin) { return; }
    this.shape.set(null);
    this.loadError.set(null);
    this.loading.set(true);
    this.gtfsData.getShapeForItinerary(itin.id).subscribe({
      next: (data) => {
        this.shape.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.shape.set(null);
        this.loading.set(false);
        this.loadError.set(httpErrorMessage(err, this.transloco.translate('admin.shapes.loadFailed')));
      },
    });
  }

  textColor(line: Itinerary['line']): string {
    return lineTextColor(line) || readableTextColor(line.color);
  }

  private project(points: ShapePoint[]): ProjectedPoint[] {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    for (const p of points) {
      if (p.latitude < minLat) {minLat = p.latitude;}
      if (p.latitude > maxLat) {maxLat = p.latitude;}
      if (p.longitude < minLon) {minLon = p.longitude;}
      if (p.longitude > maxLon) {maxLon = p.longitude;}
    }
    const latRange = maxLat - minLat || 1e-6;
    const lonRange = maxLon - minLon || 1e-6;

    // Compensate for latitude distortion in the longitude axis. At
    // 45° lat, 1° lon ≈ 0.71° lat in metres; without this factor the
    // SVG would stretch east-west on north-south oriented routes.
    const latMid = (minLat + maxLat) / 2;
    const lonScale = Math.cos(latMid * Math.PI / 180);
    const adjLonRange = lonRange * lonScale;

    const ratio = adjLonRange / latRange;
    const targetRatio = ShapesComponent.VIEW_W / ShapesComponent.VIEW_H;

    const w = ShapesComponent.VIEW_W * (1 - 2 * ShapesComponent.MARGIN);
    const h = ShapesComponent.VIEW_H * (1 - 2 * ShapesComponent.MARGIN);

    let scaleX: number, scaleY: number;
    if (ratio > targetRatio) {
      scaleX = w / adjLonRange;
      scaleY = scaleX;
    } else {
      scaleY = h / latRange;
      scaleX = scaleY;
    }

    const usedW = adjLonRange * scaleX;
    const usedH = latRange * scaleY;
    const offsetX = (ShapesComponent.VIEW_W - usedW) / 2;
    const offsetY = (ShapesComponent.VIEW_H - usedH) / 2;

    return points.map(p => ({
      x: offsetX + (p.longitude - minLon) * lonScale * scaleX,
      // SVG y grows downward, lat grows north — flip.
      y: offsetY + (maxLat - p.latitude) * scaleY,
    }));
  }
}
