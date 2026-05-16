import { TestBed, ComponentFixture } from '@angular/core/testing';
import { testTranslocoModule } from '../../../test-translations';
import { provideRouter, Router, RouterLink } from '@angular/router';
import { signal, Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatDialog } from '@angular/material/dialog';
import { NetworkMapComponent } from './network-map.component';
import { NetworkMapDataService } from './services/network-map-data.service';
import { SchematicLayoutService, LayoutStop } from './services/schematic-layout.service';
import { RouteFinderService, RouteResult } from './services/route-finder.service';
import { ThemeService } from '@core/services/theme.service';
import { LocaleService } from '@core/i18n/locale.service';
import { NetworkMap, NetworkMapAlerts, NetworkLine } from '@shared/models';

// Stub child components to avoid their complex dependencies
@Component({ selector: 'app-schematic-map', standalone: true, template: '<ng-content />', changeDetection: ChangeDetectionStrategy.OnPush })
class MockSchematicMapComponent {
  lines = input.required<NetworkLine[]>();
  stops = input.required<LayoutStop[]>();
  lineColorMap = input.required<Map<string, string>>();
  visibleLineCodes = input.required<string[]>();
  alerts = input<NetworkMapAlerts>();
  routeResult = input<RouteResult | null>();
  departureStopId = input<string | null>(null);
  arrivalStopId = input<string | null>(null);
  highlightedStopId = input<string | null>(null);
  stopSelected = output<LayoutStop>();
  filterChange = output<string[]>();
  centerOnStop = vi.fn();
}

@Component({ selector: 'app-route-search-bar', standalone: true, template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class MockRouteSearchBarComponent {
  stops = input.required<LayoutStop[]>();
  departureStop = input<LayoutStop | null>();
  arrivalStop = input<LayoutStop | null>();
  routeResult = input<RouteResult | null>();
  searchRoute = output<{ from: string; to: string }>();
  clearRoute = output();
  departureChanged = output<LayoutStop | null>();
  arrivalChanged = output<LayoutStop | null>();
}

@Component({ selector: 'app-feed-credits', standalone: true, template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class MockFeedCreditsComponent {}

describe('NetworkMapComponent', () => {
  let component: NetworkMapComponent;
  let fixture: ComponentFixture<NetworkMapComponent>;
  let mockNetworkMapService: { getNetworkMap: ReturnType<typeof vi.fn>; getAlerts: ReturnType<typeof vi.fn> };
  let mockLayoutService: { calculateLayout: ReturnType<typeof vi.fn> };
  let mockRouteFinder: { findRoute: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockThemeService: { isDarkMode: ReturnType<typeof signal<boolean>>; toggleTheme: ReturnType<typeof vi.fn> };

  const mockStops: LayoutStop[] = [
    { id: 's1', name: 'Alpha', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 100, y: 200 },
    { id: 's2', name: 'Bravo', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 200, y: 200 },
    { id: 's3', name: 'Charlie', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'], x: 300, y: 300 },
  ];

  /** Single-segment direct L1 route from s1 to s2, reused by every test that
   *  needs an "active route" without caring about the route's specifics. */
  const directRouteS1S2: RouteResult = {
    segments: [{
      lineId: 'line1',
      lineCode: 'L1',
      lineColor: '#FF0000',
      stopIds: ['s1', 's2'],
      stopNames: ['Alpha', 'Bravo'],
      directionName: 'Bravo',
    }],
    transfers: 0,
    transferStopIds: [],
    allStopIds: ['s1', 's2'],
  };

  const mockNetworkMap: NetworkMap = {
    lines: [
      { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, itineraries: [['s1', 's2']] },
      { id: 'line2', code: 'L2', name: 'Line 2', color: '#0000FF', type: null, itineraries: [['s3']] },
    ],
    stops: [
      { id: 's1', name: 'Alpha', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'] },
      { id: 's2', name: 'Bravo', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'] },
      { id: 's3', name: 'Charlie', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'] },
    ],
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
  };

  const emptyAlerts: NetworkMapAlerts = { networkAlerts: [], lineAlerts: {}, stopAlerts: {} };

  beforeEach(() => {
    mockNetworkMapService = {
      getNetworkMap: vi.fn().mockReturnValue(of(mockNetworkMap)),
      getAlerts: vi.fn().mockReturnValue(of(emptyAlerts)),
    };

    mockLayoutService = {
      calculateLayout: vi.fn().mockReturnValue({
        stops: mockStops,
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 },
      }),
    };

    mockRouteFinder = {
      findRoute: vi.fn().mockReturnValue(null),
    };

    mockDialog = {
      open: vi.fn().mockReturnValue({ afterClosed: () => of(undefined), close: vi.fn() }),
    };

    mockThemeService = {
      isDarkMode: signal(false),
      toggleTheme: vi.fn(),
    };

    const mockLocaleService = {
      current: signal('fr'),
      setLang: vi.fn(),
      toggle: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [NetworkMapComponent, testTranslocoModule({
            map: {
              loadFailedSnackbar: 'Failed to load network map. Please try again.',
              routeStaleNotice: 'Route is stale: one of your stops is no longer in the network.',
              subtitle: {
                directRoute: 'Direct route — {{ stops }} stops',
                transferOne: '1 transfer',
                transferOther: '{{ count }} transfers',
                departure: 'Departure: {{ name }} — pick an arrival stop',
                clickStopHint: 'Click on a stop to see upcoming departures',
              },
              route: { stopOne: '1 stop', stopOther: '{{ count }} stops' },
            },
          }, {
            map: {
              loadFailedSnackbar: 'Impossible de charger la carte du réseau. Réessayez plus tard.',
              routeStaleNotice: 'Itinéraire obsolète : un de vos arrêts n\'est plus dans le réseau.',
              subtitle: {
                directRoute: 'Trajet direct — {{ stops }} arrêts',
                transferOne: '1 correspondance',
                transferOther: '{{ count }} correspondances',
                departure: 'Départ : {{ name }} — choisissez un arrêt d\'arrivée',
                clickStopHint: 'Cliquez un arrêt pour voir les prochains passages',
              },
              route: { stopOne: '1 arrêt', stopOther: '{{ count }} arrêts' },
            },
          })],
      providers: [
        provideRouter([]),
        { provide: NetworkMapDataService, useValue: mockNetworkMapService },
        { provide: SchematicLayoutService, useValue: mockLayoutService },
        { provide: RouteFinderService, useValue: mockRouteFinder },
        { provide: MatDialog, useValue: mockDialog },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: LocaleService, useValue: mockLocaleService },
      ],
    }).overrideComponent(NetworkMapComponent, {
      set: {
        imports: [
          ReactiveFormsModule,
          RouterLink,
          MatAutocompleteModule,
          MatButtonModule,
          MatFormFieldModule,
          MatIconModule,
          MatInputModule,
          MatProgressSpinnerModule,
          MockSchematicMapComponent,
          MockRouteSearchBarComponent,
          MockFeedCreditsComponent,
          TranslocoPipe,
        ],
      },
    });

    fixture = TestBed.createComponent(NetworkMapComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load network on init', () => {
    fixture.detectChanges();

    expect(mockNetworkMapService.getNetworkMap).toHaveBeenCalled();
    expect(mockNetworkMapService.getAlerts).toHaveBeenCalled();
  });

  it('should set loading to false after network loads', () => {
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
  });

  it('should set networkMap after successful load', () => {
    fixture.detectChanges();

    expect(component.networkMap()).toEqual(mockNetworkMap);
  });

  it('should compute lines from networkMap', () => {
    fixture.detectChanges();

    expect(component.lines().length).toBe(2);
    expect(component.lines()[0]!.code).toBe('L1');
  });

  it('should compute layoutStops', () => {
    fixture.detectChanges();

    expect(component.layoutStops().length).toBe(3);
    expect(mockLayoutService.calculateLayout).toHaveBeenCalled();
  });

  it('should compute lineColorMap', () => {
    fixture.detectChanges();

    const map = component.lineColorMap();
    expect(map.get('L1')).toBe('#FF0000');
    expect(map.get('L2')).toBe('#0000FF');
  });

  it('should show error state on network load failure', () => {
    mockNetworkMapService.getNetworkMap = vi.fn().mockReturnValue(throwError(() => new Error('Network error')));
    fixture.detectChanges();

    expect(component.error()).toBe('Failed to load network map. Please try again.');
    expect(component.loading()).toBe(false);
  });


  it('should handle alerts loading failure gracefully', () => {
    mockNetworkMapService.getAlerts = vi.fn().mockReturnValue(throwError(() => new Error('Alerts fail')));
    fixture.detectChanges();

    // Network should still load, alerts default to empty
    expect(component.loading()).toBe(false);
    expect(component.alerts()).toEqual(emptyAlerts);
  });

  describe('subtitle', () => {
    it('should show default subtitle when no route active', () => {
      fixture.detectChanges();

      expect(component.subtitle()).toBe('Click on a stop to see upcoming departures');
    });

    it('should show departure hint when only departure is selected', () => {
      fixture.detectChanges();

      component.departureStop.set(mockStops[0]!);
      expect(component.subtitle()).toContain('Departure: Alpha');
      expect(component.subtitle()).toContain('arrival stop');
    });

    it('should show route info when route is active', () => {
      fixture.detectChanges();

      component.routeResult.set(directRouteS1S2);

      expect(component.subtitle()).toContain('Direct route');
      expect(component.subtitle()).toContain('2 stops');
    });

    it('should show transfer count in subtitle', () => {
      fixture.detectChanges();

      component.routeResult.set({
        segments: [
          { lineId: 'line1', lineCode: 'L1', lineColor: '#FF0000', stopIds: ['s1', 's2'], stopNames: ['Alpha', 'Bravo'], directionName: 'Bravo' },
          { lineId: 'line2', lineCode: 'L2', lineColor: '#0000FF', stopIds: ['s2', 's3'], stopNames: ['Bravo', 'Charlie'], directionName: 'Charlie' },
        ],
        transfers: 1,
        transferStopIds: ['s2'],
        allStopIds: ['s1', 's2', 's3'],
      });

      expect(component.subtitle()).toContain('1 transfer');
      expect(component.subtitle()).toContain('3 stops');
    });
  });

  describe('route operations', () => {
    it('should find route using route finder', () => {
      mockRouteFinder.findRoute = vi.fn().mockReturnValue(directRouteS1S2);
      fixture.detectChanges();

      component.onRouteSearch({ from: 's1', to: 's2' });

      expect(mockRouteFinder.findRoute).toHaveBeenCalledWith(mockNetworkMap, 's1', 's2', { accessibleOnly: false, pathwayPenaltySeconds: 0 });
      expect(component.routeResult()).toEqual(directRouteS1S2);
    });

    it('should clear route state on onRouteClear', () => {
      fixture.detectChanges();

      component.departureStop.set(mockStops[0]!);
      component.arrivalStop.set(mockStops[1]!);
      component.routeResult.set({
        segments: [],
        transfers: 0,
        transferStopIds: [],
        allStopIds: [],
      });

      component.onRouteClear();

      expect(component.routeResult()).toBeNull();
      expect(component.departureStop()).toBeNull();
      expect(component.arrivalStop()).toBeNull();
      expect(component.showFullNetwork()).toBe(false);
    });

    it('should update departureStop on onDepartureChanged', () => {
      fixture.detectChanges();

      component.onDepartureChanged(mockStops[0]!);

      expect(component.departureStop()).toEqual(mockStops[0]!);
      expect(component.routeResult()).toBeNull();
    });

    it('should clear an active route when the category changes', () => {
      fixture.detectChanges();

      component.departureStop.set(mockStops[0]!);
      component.arrivalStop.set(mockStops[1]!);
      component.routeResult.set({
        segments: [],
        transfers: 0,
        transferStopIds: [],
        allStopIds: [],
      });

      component.setCategory('OTHER');

      expect(component.routeResult()).toBeNull();
      expect(component.departureStop()).toBeNull();
      expect(component.arrivalStop()).toBeNull();
    });

    it('should update arrivalStop on onArrivalChanged', () => {
      fixture.detectChanges();

      component.onArrivalChanged(mockStops[1]!);

      expect(component.arrivalStop()).toEqual(mockStops[1]!);
      expect(component.routeResult()).toBeNull();
    });

    it('writes ?from when departure changes and clears it on null', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      component.onDepartureChanged(mockStops[0]!);
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toMatch(/[?&]from=s1/);

      component.onDepartureChanged(null);
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).not.toMatch(/[?&]from=/);
    });

    it('writes ?from and ?to when a route is searched', async () => {
      mockRouteFinder.findRoute = vi.fn().mockReturnValue({
        segments: [{ lineId: 'line1', lineCode: 'L1', lineColor: '#FF0000',
                     stopIds: ['s1', 's2'], stopNames: ['Alpha', 'Bravo'], directionName: 'Bravo' }],
        transfers: 0, transferStopIds: [], allStopIds: ['s1', 's2'],
      });
      fixture.detectChanges();
      await fixture.whenStable();

      component.onRouteSearch({ from: 's1', to: 's2' });
      await fixture.whenStable();

      const url = TestBed.inject(Router).url;
      expect(url).toMatch(/[?&]from=s1/);
      expect(url).toMatch(/[?&]to=s2/);
    });

    it('clears ?from and ?to on onRouteClear', async () => {
      fixture.detectChanges();
      component.onDepartureChanged(mockStops[0]!);
      component.onArrivalChanged(mockStops[1]!);
      await fixture.whenStable();

      component.onRouteClear();
      await fixture.whenStable();

      const url = TestBed.inject(Router).url;
      expect(url).not.toMatch(/[?&]from=/);
      expect(url).not.toMatch(/[?&]to=/);
    });
  });

  describe('stop search', () => {
    it('should return display name for a stop object', () => {
      const result = component.stopDisplayFn(mockStops[0]!);
      expect(result).toBe('Alpha');
    });

    it('should return string value as-is for string input', () => {
      const result = component.stopDisplayFn('some text');
      expect(result).toBe('some text');
    });

    it('should return empty string for falsy input', () => {
      expect(component.stopDisplayFn('')).toBe('');
      expect(component.stopDisplayFn(null as unknown as string)).toBe('');
    });

    it('should filter stops based on search text', () => {
      fixture.detectChanges();

      // Initially no filter, should return empty (filter requires text)
      expect(component.filteredStops().length).toBe(0);
    });

    it('should clear stop search state', () => {
      fixture.detectChanges();

      component.highlightedStopId.set('s1');
      component.clearStopSearch();

      expect(component.highlightedStopId()).toBeNull();
    });
  });

  describe('toggleNetworkView', () => {
    it('should toggle showFullNetwork signal', () => {
      fixture.detectChanges();

      expect(component.showFullNetwork()).toBe(false);
      component.toggleNetworkView();
      expect(component.showFullNetwork()).toBe(true);
      component.toggleNetworkView();
      expect(component.showFullNetwork()).toBe(false);
    });
  });

  describe('theme toggle', () => {
    it('should expose themeService for template binding', () => {
      expect(component.themeService).toBeTruthy();
      expect(component.themeService.isDarkMode()).toBe(false);
    });
  });

  describe('loadNetwork retry', () => {
    it('should reload network data when called', () => {
      fixture.detectChanges();
      mockNetworkMapService.getNetworkMap.mockClear();
      mockNetworkMapService.getAlerts.mockClear();

      component.loadNetwork();

      expect(mockNetworkMapService.getNetworkMap).toHaveBeenCalled();
      expect(mockNetworkMapService.getAlerts).toHaveBeenCalled();
    });

    it('should reset error and set loading when retrying', () => {
      mockNetworkMapService.getNetworkMap = vi.fn().mockReturnValue(throwError(() => new Error()));
      fixture.detectChanges();
      expect(component.error()).toBeTruthy();

      // Now fix the mock and retry
      mockNetworkMapService.getNetworkMap = vi.fn().mockReturnValue(of(mockNetworkMap));
      mockNetworkMapService.getAlerts = vi.fn().mockReturnValue(of(emptyAlerts));

      component.loadNetwork();

      expect(component.error()).toBeNull();
      expect(component.loading()).toBe(false);
    });
  });

  describe('route selection mode', () => {
    it('should set arrival and trigger route search when clicking a different stop', () => {
      mockRouteFinder.findRoute = vi.fn().mockReturnValue(directRouteS1S2);
      fixture.detectChanges();

      // Enter route selection mode: departure set, arrival null, no routeResult
      component.departureStop.set(mockStops[0]!);
      component.arrivalStop.set(null);
      component.routeResult.set(null);

      // Click a different stop
      component.onStopSelected(mockStops[1]!);

      expect(component.arrivalStop()).toEqual(mockStops[1]!);
      expect(mockRouteFinder.findRoute).toHaveBeenCalledWith(mockNetworkMap, 's1', 's2', { accessibleOnly: false, pathwayPenaltySeconds: 0 });
      expect(component.routeResult()).toEqual(directRouteS1S2);
    });

    it('should open popup instead when clicking the same departure stop', () => {
      fixture.detectChanges();

      // Enter route selection mode
      component.departureStop.set(mockStops[0]!);
      component.arrivalStop.set(null);
      component.routeResult.set(null);

      // Click the same stop as departure
      component.onStopSelected(mockStops[0]!);

      // Should open dialog, not set arrival
      expect(component.arrivalStop()).toBeNull();
      expect(mockDialog.open).toHaveBeenCalled();
    });
  });

  describe('onFilterChange with active route', () => {
    it('should set showFullNetwork to true when route is active', () => {
      fixture.detectChanges();

      component.routeResult.set(directRouteS1S2);
      component.showFullNetwork.set(false);

      component.onFilterChange(['L1']);

      expect(component.showFullNetwork()).toBe(true);
    });
  });

  describe('visibleLineCodes auto-filtering', () => {
    it('should return only route line codes when route is active and showFullNetwork is false', () => {
      fixture.detectChanges();

      component.routeResult.set(directRouteS1S2);
      component.showFullNetwork.set(false);

      const codes = component.visibleLineCodes();

      expect(codes).toEqual(['L1']);
      expect(codes).not.toContain('L2');
    });
  });

  describe('filteredStops with search text', () => {
    it('should return matching stops when stopSearchCtrl has text', () => {
      fixture.detectChanges();

      component.stopSearchCtrl.setValue('alp');
      fixture.detectChanges();

      const filtered = component.filteredStops();
      expect(filtered.length).toBe(1);
      expect(filtered[0]!.name).toBe('Alpha');
    });

    it('should match case-insensitively', () => {
      fixture.detectChanges();

      component.stopSearchCtrl.setValue('BRAVO');
      fixture.detectChanges();

      const filtered = component.filteredStops();
      expect(filtered.length).toBe(1);
      expect(filtered[0]!.name).toBe('Bravo');
    });
  });

  describe('onStopSearchSelected flow', () => {
    it('should clear search filter, set highlighted stop, and open dialog', () => {
      fixture.detectChanges();

      const mockEvent = {
        option: { value: mockStops[0] },
      } as unknown as MatAutocompleteSelectedEvent;

      component.onStopSearchSelected(mockEvent);

      expect(component.highlightedStopId()).toBe('s1');
      expect(mockDialog.open).toHaveBeenCalled();
    });
  });

  describe('subtitle with multiple transfers', () => {
    it('should show plural "transfers" when transfers > 1', () => {
      fixture.detectChanges();

      component.routeResult.set({
        segments: [
          { lineId: 'line1', lineCode: 'L1', lineColor: '#FF0000', stopIds: ['s1', 's2'], stopNames: ['Alpha', 'Bravo'], directionName: 'Bravo' },
          { lineId: 'line2', lineCode: 'L2', lineColor: '#0000FF', stopIds: ['s2', 's3'], stopNames: ['Bravo', 'Charlie'], directionName: 'Charlie' },
          { lineId: 'line1', lineCode: 'L1', lineColor: '#FF0000', stopIds: ['s3', 's1'], stopNames: ['Charlie', 'Alpha'], directionName: 'Alpha' },
        ],
        transfers: 2,
        transferStopIds: ['s2', 's3'],
        allStopIds: ['s1', 's2', 's3'],
      });

      expect(component.subtitle()).toContain('2 transfers');
      expect(component.subtitle()).not.toContain('2 transfer —');
    });
  });
});
