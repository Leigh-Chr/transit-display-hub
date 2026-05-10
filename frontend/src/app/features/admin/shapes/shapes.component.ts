import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { TranslocoDirective } from '@jsverse/transloco';

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
  template: `
    <ng-container *transloco="let t">
    <div class="shapes-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.shapes.title') }}</h1>
        <p class="page-subtitle">{{ t('admin.shapes.subtitle') }}</p>
      </div>

      <mat-form-field appearance="outline" class="itin-picker">
        <mat-label>{{ t('admin.shapes.itinPickerLabel') }}</mat-label>
        <input
          type="text"
          matInput
          [(ngModel)]="search"
          (ngModelChange)="onSearchChange()"
          [matAutocomplete]="auto"
          [placeholder]="t('admin.shapes.itinPickerPlaceholder')">
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onItinSelected($event.option.value)">
          @for (it of filteredItins(); track it.id) {
            <mat-option [value]="it">
              <span class="line-chip"
                    [style.background]="it.line.color"
                    [style.color]="textColor(it.line)">
                {{ it.line.code }}
              </span>
              {{ it.name }}
              @if (it.terminusName) {
                <span class="muted">→ {{ it.terminusName }}</span>
              }
            </mat-option>
          }
        </mat-autocomplete>
        <mat-icon matSuffix>route</mat-icon>
      </mat-form-field>

      @if (selectedItin(); as itin) {
        <mat-card class="shape-card">
          <mat-card-content>
            <div class="shape-header">
              <div>
                <span class="line-chip"
                      [style.background]="itin.line.color"
                      [style.color]="textColor(itin.line)">
                  {{ itin.line.code }}
                </span>
                <strong>{{ itin.name }}</strong>
                @if (itin.terminusName) {
                  <span class="muted">→ {{ itin.terminusName }}</span>
                }
              </div>
              @if (shape()) {
                <div class="shape-stats">
                  <span class="stat" [matTooltip]="t('admin.shapes.tooltipPoints')">
                    <mat-icon>scatter_plot</mat-icon>
                    {{ shape()!.points.length }} pts
                  </span>
                  @if (totalDistanceKm() !== null) {
                    <span class="stat" [matTooltip]="t('admin.shapes.tooltipDistance')">
                      <mat-icon>straighten</mat-icon>
                      {{ totalDistanceKm()!.toFixed(1) }} km
                    </span>
                  }
                </div>
              }
            </div>

            @if (loading()) {
              <div class="shape-canvas placeholder">{{ t('admin.shapes.loading') }}</div>
            } @else if (!shape() || shape()!.points.length < 2) {
              <app-empty-state
                icon="signal_disconnected"
                [title]="t('admin.shapes.emptyShapeTitle')"
                [description]="t('admin.shapes.emptyShapeDesc')" />
            } @else {
              <svg
                [attr.viewBox]="viewBox()"
                preserveAspectRatio="xMidYMid meet"
                class="shape-canvas"
                [style.--shape-color]="itin.line.color">
                <polyline
                  [attr.points]="polylinePoints()"
                  fill="none"
                  [attr.stroke]="itin.line.color"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
                @if (firstPoint(); as first) {
                  <circle
                    [attr.cx]="first.x"
                    [attr.cy]="first.y"
                    r="4"
                    [attr.fill]="itin.line.color"
                    stroke="white"
                    stroke-width="1.5" />
                }
                @if (lastPoint(); as last) {
                  <circle
                    [attr.cx]="last.x"
                    [attr.cy]="last.y"
                    r="4"
                    fill="white"
                    [attr.stroke]="itin.line.color"
                    stroke-width="2" />
                }
              </svg>
            }
          </mat-card-content>
        </mat-card>
      } @else {
        <app-empty-state
          icon="search"
          [title]="t('admin.shapes.emptySelectTitle')"
          [description]="t('admin.shapes.emptySelectDesc')" />
      }
    </div>
    </ng-container>
  `,
  styles: `
    .shapes-page { max-width: 1100px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: 1.6rem; font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .itin-picker { width: 100%; max-width: 560px; margin-bottom: 24px; }
    .muted { color: var(--mat-sys-on-surface-variant); margin-left: 6px; }

    .line-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.85em;
      margin-right: 8px;
      font-variant-numeric: tabular-nums;
    }

    .shape-card { margin-top: 8px; }
    .shape-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .shape-stats {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .stat {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.9rem;
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-on-surface-variant);
    }
    .stat mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .shape-canvas {
      display: block;
      width: 100%;
      height: 480px;
      background: var(--mat-sys-surface-container-low);
      border-radius: 8px;
    }
    .shape-canvas.placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.95rem;
    }
  `,
})
export class ShapesComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);
  private readonly itineraryService = inject(ItineraryService);

  private static readonly VIEW_W = 800;
  private static readonly VIEW_H = 480;
  private static readonly MARGIN = 0.08;

  readonly itineraries = signal<Itinerary[]>([]);
  readonly filteredItins = signal<Itinerary[]>([]);
  readonly selectedItin = signal<Itinerary | null>(null);
  readonly shape = signal<Shape | null>(null);
  readonly loading = signal(false);

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

  ngOnInit(): void {
    this.itineraryService.getAll().subscribe({
      next: (data) => {
        this.itineraries.set(data);
        this.filteredItins.set(data.slice(0, 30));
      },
      error: () => this.itineraries.set([]),
    });
  }

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
    this.shape.set(null);
    this.loading.set(true);
    this.gtfsData.getShapeForItinerary(itin.id).subscribe({
      next: (data) => {
        this.shape.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.shape.set(null);
        this.loading.set(false);
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
