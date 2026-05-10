import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TadZonesComponent } from './tad-zones.component';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { FlexLocation } from '@shared/models';
import { TranslocoTestingModule } from '@jsverse/transloco';

const POLYGON_NORTH: FlexLocation = {
  id: '1',
  externalId: 'FLEX_NORTH',
  stopExternalId: 'STOP_A',
  name: 'Zone Nord',
  geometryType: 'Polygon',
  geometryJson: JSON.stringify({
    type: 'Polygon',
    coordinates: [[[5.70, 45.18], [5.75, 45.18], [5.75, 45.20], [5.70, 45.20], [5.70, 45.18]]],
  }),
  minLongitude: 5.70, maxLongitude: 5.75,
  minLatitude: 45.18, maxLatitude: 45.20,
};

const POLYGON_SOUTH: FlexLocation = {
  id: '2',
  externalId: 'FLEX_SOUTH',
  stopExternalId: null,
  name: 'Zone Sud',
  geometryType: 'Polygon',
  geometryJson: JSON.stringify({
    type: 'Polygon',
    coordinates: [[[5.71, 45.10], [5.74, 45.10], [5.74, 45.13], [5.71, 45.13], [5.71, 45.10]]],
  }),
  minLongitude: 5.71, maxLongitude: 5.74,
  minLatitude: 45.10, maxLatitude: 45.13,
};

describe('TadZonesComponent', () => {
  let component: TadZonesComponent;
  let fixture: ComponentFixture<TadZonesComponent>;
  let mockGtfsData: { getFlexLocations: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGtfsData = {
      getFlexLocations: vi.fn().mockReturnValue(of([POLYGON_NORTH, POLYGON_SOUTH])),
    };

    TestBed.configureTestingModule({
      imports: [
        TadZonesComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {}, fr: {} },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: GtfsDataService, useValue: mockGtfsData },
      ],
    });

    fixture = TestBed.createComponent(TadZonesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads locations on init and renders one path per ring', () => {
    fixture.detectChanges();

    expect(mockGtfsData.getFlexLocations).toHaveBeenCalledOnce();
    expect(component.locations()).toHaveLength(2);
    expect(component.renderedRings()).toHaveLength(2);
    expect(component.renderedRings()[0]?.path.startsWith('M ')).toBe(true);
  });

  it('clicking a polygon selects it; clicking the same one again clears the selection', () => {
    fixture.detectChanges();
    expect(component.selectedIndex()).toBeNull();

    component.onPolygonClick(0);
    expect(component.selectedIndex()).toBe(0);

    component.onPolygonClick(0);
    expect(component.selectedIndex()).toBeNull();

    component.onPolygonClick(1);
    expect(component.selectedIndex()).toBe(1);
  });

  it('opacity boosts the selected polygon and dims the others', () => {
    fixture.detectChanges();
    component.onPolygonClick(0);

    expect(component.opacityFor(0)).toBeGreaterThan(component.opacityFor(1));
  });

  it('without a selection, hovering dims the rest of the canvas', () => {
    fixture.detectChanges();
    component.hoveredIndex.set(0);

    expect(component.opacityFor(0)).toBeGreaterThanOrEqual(component.opacityFor(1));
  });

  it('shows the empty state when the API returns no locations', () => {
    mockGtfsData.getFlexLocations.mockReturnValue(of([]));
    fixture.detectChanges();

    expect(component.locations()).toEqual([]);
    expect(component.renderedRings()).toEqual([]);
  });

  it('falls back to an empty list when the API errors', () => {
    const noop = (): void => undefined;
    mockGtfsData.getFlexLocations.mockReturnValue({
      subscribe: ({ error }: { error: () => void }) => {
        error();
        return { unsubscribe: noop };
      },
    });
    fixture.detectChanges();

    expect(component.locations()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('viewBox covers all loaded locations after the union', () => {
    fixture.detectChanges();
    expect(component.viewBox()).toBe('0 0 800 480');
  });

  it('colorFor and strokeFor return matching hue HSL strings', () => {
    fixture.detectChanges();
    expect(component.colorFor(0)).toMatch(/^hsl\(0, 55%, 60%\)$/);
    expect(component.strokeFor(0)).toMatch(/^hsl\(0, 55%, 35%\)$/);
  });
});
