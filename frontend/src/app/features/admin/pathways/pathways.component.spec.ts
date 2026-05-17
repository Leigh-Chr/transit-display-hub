import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PathwaysComponent } from './pathways.component';
import { buildPathwayGraphLayout } from './pathway-graph-layout';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { StopService } from '@core/api/stop.service';
import { Pathway, Stop } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

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
      imports: [
        PathwaysComponent,
        testTranslocoModule({}),
      ],
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

  // Search/filter is now owned by the shared <app-stop-autocomplete> and
  // covered by stop-autocomplete.component.spec.ts.

  describe('graphLayout', () => {
    function pathway(overrides: Partial<Pathway> = {}): Pathway {
      return {
        id: 'p',
        externalId: null,
        fromStopId: 'a',
        fromStopName: 'A',
        toStopId: 'b',
        toStopName: 'B',
        pathwayMode: 'WALKWAY',
        bidirectional: true,
        lengthMetres: null,
        traversalTimeSeconds: null,
        stairCount: null,
        maxSlope: null,
        minWidthMetres: null,
        signpostedAs: null,
        reversedSignpostedAs: null,
        ...overrides,
      };
    }

    it('returns null when no pathways are loaded', () => {
      fixture.detectChanges();
      // No selected stop yet, no pathways: layout is null.
      expect(component.graphLayout()).toBeNull();
    });

    it('lays out a small chain rooted at the selected stop', () => {
      // a -> b -> c, BFS depths 0/1/2.
      const layout = buildPathwayGraphLayout([
        pathway({ id: 'p1', fromStopId: 'a', fromStopName: 'A',
                  toStopId: 'b', toStopName: 'B' }),
        pathway({ id: 'p2', fromStopId: 'b', fromStopName: 'B',
                  toStopId: 'c', toStopName: 'C', pathwayMode: 'STAIRS' }),
      ], 'a');

      expect(layout.nodes).toHaveLength(3);
      expect(layout.edges).toHaveLength(2);

      const a = layout.nodes.find(n => n.id === 'a');
      const b = layout.nodes.find(n => n.id === 'b');
      const c = layout.nodes.find(n => n.id === 'c');
      expect(a?.isCurrent).toBe(true);
      expect(b?.isCurrent).toBe(false);
      // BFS columns increment by colWidth=140 — so c.x > b.x > a.x.
      expect(b!.x).toBeGreaterThan(a!.x);
      expect(c!.x).toBeGreaterThan(b!.x);
    });

    it('marks STAIRS edges with a dash pattern', () => {
      const layout = buildPathwayGraphLayout([
        pathway({ pathwayMode: 'STAIRS' }),
      ], 'a');
      expect(layout.edges).toHaveLength(1);
      expect(layout.edges[0]!.dash).toBe('4 4');
    });

    it('uses no dash for non-STAIRS modes', () => {
      const layout = buildPathwayGraphLayout([
        pathway({ pathwayMode: 'ELEVATOR' }),
      ], 'a');
      expect(layout.edges[0]!.dash).toBeNull();
    });

    it('emits an arrowPoints triangle for one-way pathways and empty for bidirectional', () => {
      const directed = buildPathwayGraphLayout([
        pathway({ pathwayMode: 'EXIT_GATE', bidirectional: false }),
      ], 'a');
      expect(directed.edges[0]!.arrowPoints).not.toBe('');

      const both = buildPathwayGraphLayout([
        pathway({ pathwayMode: 'WALKWAY', bidirectional: true }),
      ], 'a');
      expect(both.edges[0]!.arrowPoints).toBe('');
    });

    it('builds a legend with one entry per pathway mode used', () => {
      const layout = buildPathwayGraphLayout([
        pathway({ id: 'p1', pathwayMode: 'WALKWAY' }),
        pathway({ id: 'p2', pathwayMode: 'STAIRS', toStopId: 'c', toStopName: 'C' }),
        pathway({ id: 'p3', pathwayMode: 'WALKWAY', toStopId: 'd', toStopName: 'D' }),
      ], 'a');
      const modes = layout.legend.map(l => l.mode).sort();
      expect(modes).toEqual(['STAIRS', 'WALKWAY']);
      const stairs = layout.legend.find(l => l.mode === 'STAIRS');
      expect(stairs?.dashed).toBe(true);
    });
  });
});
