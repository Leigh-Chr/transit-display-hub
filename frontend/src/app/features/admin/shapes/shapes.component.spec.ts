import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShapesComponent } from './shapes.component';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { ItineraryService } from '@core/api/itinerary.service';
import { Itinerary, Shape } from '@shared/models';

describe('ShapesComponent', () => {
  let component: ShapesComponent;
  let fixture: ComponentFixture<ShapesComponent>;
  let mockGtfsDataService: { getShapeForItinerary: ReturnType<typeof vi.fn> };
  let mockItineraryService: { getAll: ReturnType<typeof vi.fn> };

  const mockLine = {
    id: 'L1', code: 'L1', name: 'Metro 1', color: '#FF5733', textColor: null,
    type: 'METRO' as const,
  };

  const mockItin: Itinerary = {
    id: 'i1',
    name: 'North',
    terminusName: 'Terminus N',
      directionId: null,
    line: mockLine,
    stops: [],
  };

  const mockShape: Shape = {
    id: 'sh1',
    externalId: 'shape-1',
    points: [
      { latitude: 44.8378, longitude: -0.5792, distTraveled: 0 },
      { latitude: 44.8480, longitude: -0.5750, distTraveled: 1200 },
      { latitude: 44.8550, longitude: -0.5700, distTraveled: 2400 },
    ],
  };

  beforeEach(() => {
    mockGtfsDataService = {
      getShapeForItinerary: vi.fn().mockReturnValue(of(mockShape)),
    };
    mockItineraryService = {
      getAll: vi.fn().mockReturnValue(of([mockItin])),
    };

    TestBed.configureTestingModule({
      imports: [ShapesComponent],
      providers: [
        provideRouter([]),
        { provide: GtfsDataService, useValue: mockGtfsDataService },
        { provide: ItineraryService, useValue: mockItineraryService },
      ],
    });

    fixture = TestBed.createComponent(ShapesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads itineraries on init for the autocomplete', () => {
    fixture.detectChanges();

    expect(mockItineraryService.getAll).toHaveBeenCalledOnce();
    expect(component.itineraries().length).toBe(1);
    expect(component.filteredItins().length).toBe(1);
  });

  it('selecting an itinerary fetches the shape and projects each point', () => {
    fixture.detectChanges();

    component.onItinSelected(mockItin);

    expect(mockGtfsDataService.getShapeForItinerary).toHaveBeenCalledWith('i1');
    expect(component.shape()).toEqual(mockShape);
    expect(component.projectedPoints().length).toBe(3);
  });

  it('first/last points anchor at the polyline endpoints', () => {
    fixture.detectChanges();
    component.onItinSelected(mockItin);

    const points = component.projectedPoints();
    expect(component.firstPoint()).toEqual(points[0]);
    expect(component.lastPoint()).toEqual(points[points.length - 1]);
  });

  it('totalDistanceKm divides metres by 1000 when over 10k', () => {
    fixture.detectChanges();
    component.onItinSelected(mockItin);
    // distTraveled: 2400 metres → stays in metres (under 10k threshold)
    expect(component.totalDistanceKm()).toBe(2400);

    // Force an over-10k value: the conversion kicks in.
    component.shape.set({
      ...mockShape,
      points: [
        { latitude: 44.83, longitude: -0.57, distTraveled: 0 },
        { latitude: 44.85, longitude: -0.55, distTraveled: 15000 },
      ],
    });
    expect(component.totalDistanceKm()).toBe(15);
  });

  it('search filters itineraries by name and line code', () => {
    fixture.detectChanges();
    component.itineraries.set([
      mockItin,
      { ...mockItin, id: 'i2', name: 'East', line: { ...mockLine, code: 'L2', name: 'Metro 2' } },
    ]);

    component.search = 'east';
    component.onSearchChange();
    expect(component.filteredItins().length).toBe(1);
    expect(component.filteredItins()[0]?.name).toBe('East');

    component.search = 'L1';
    component.onSearchChange();
    expect(component.filteredItins().length).toBe(1);
    expect(component.filteredItins()[0]?.name).toBe('North');
  });
});
