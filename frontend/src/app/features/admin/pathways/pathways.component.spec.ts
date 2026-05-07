import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PathwaysComponent } from './pathways.component';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { StopService } from '@core/api/stop.service';
import { Pathway, Stop } from '@shared/models';

describe('PathwaysComponent', () => {
  let component: PathwaysComponent;
  let fixture: ComponentFixture<PathwaysComponent>;
  let mockGtfsDataService: { getPathwaysForStop: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };

  const mockStop: Stop = {
    id: 's1',
    name: 'Saint-Lazare',
    latitude: 48.87,
    longitude: 2.32,
    lines: [],
    scheduleCount: 0,
    hasDevice: false,
  };

  const mockPathway: Pathway = {
    id: 'p1',
    externalId: 'pw-1',
    fromStopId: 's1',
    fromStopName: 'Saint-Lazare',
    toStopId: 's2',
    toStopName: 'Quai 4',
    pathwayMode: 'ESCALATOR',
    bidirectional: false,
    lengthMetres: 18,
    traversalTimeSeconds: 30,
    stairCount: null,
    maxSlope: null,
    minWidthMetres: 1.5,
    signpostedAs: 'Vers les quais',
    reversedSignpostedAs: null,
  };

  beforeEach(() => {
    mockGtfsDataService = {
      getPathwaysForStop: vi.fn().mockReturnValue(of([mockPathway])),
    };
    mockStopService = {
      getAll: vi.fn().mockReturnValue(of([mockStop])),
    };

    TestBed.configureTestingModule({
      imports: [PathwaysComponent],
      providers: [
        provideRouter([]),
        { provide: GtfsDataService, useValue: mockGtfsDataService },
        { provide: StopService, useValue: mockStopService },
      ],
    });

    fixture = TestBed.createComponent(PathwaysComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads stops on init for the autocomplete', () => {
    fixture.detectChanges();
    expect(mockStopService.getAll).toHaveBeenCalledOnce();
    expect(component.stops().length).toBe(1);
  });

  it('selecting a stop fetches its pathways', () => {
    fixture.detectChanges();

    component.onStopSelected(mockStop);

    expect(mockGtfsDataService.getPathwaysForStop).toHaveBeenCalledWith('s1');
    expect(component.pathways().length).toBe(1);
    expect(component.selectedStop()).toEqual(mockStop);
  });

  it('mode icons cover every PathwayMode', () => {
    expect(component.modeIcon('WALKWAY')).toBe('directions_walk');
    expect(component.modeIcon('STAIRS')).toBe('stairs');
    expect(component.modeIcon('ESCALATOR')).toBe('escalator');
    expect(component.modeIcon('ELEVATOR')).toBe('elevator');
    expect(component.modeIcon('FARE_GATE')).toBe('lock');
    expect(component.modeIcon('EXIT_GATE')).toBe('logout');
    expect(component.modeIcon('MOVING_SIDEWALK')).toBe('commit');
  });

  it('search filters by name', () => {
    fixture.detectChanges();
    component.stops.set([
      mockStop,
      { ...mockStop, id: 's2', name: 'Châtelet' },
    ]);

    component.search = 'châ';
    component.onSearchChange();
    expect(component.filteredStops().length).toBe(1);
    expect(component.filteredStops()[0]?.name).toBe('Châtelet');
  });
});
