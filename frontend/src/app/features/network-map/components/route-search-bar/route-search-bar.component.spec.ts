import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RouteSearchBarComponent } from './route-search-bar.component';
import { LayoutStop } from '../../services/schematic-layout.service';
import { RouteResult } from '../../services/route-finder.service';

const mapRouteEn = {
  map: {
    route: {
      title: 'Route',
      departure: 'Departure',
      arrival: 'Arrival',
      clearAria: 'Clear search',
      swapAria: 'Swap departure and arrival',
      sameStopError: 'Same stop selected',
      noRouteFound: 'No route found between these stops',
      directionPrefix: 'dir.',
      stopOne: '1 stop',
      stopOther: '{{ count }} stops',
    },
  },
};

describe('RouteSearchBarComponent', () => {
  let component: RouteSearchBarComponent;
  let fixture: ComponentFixture<RouteSearchBarComponent>;

  const mockStops: LayoutStop[] = [
    { id: 's1', name: 'Alpha', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 10, y: 50 },
    { id: 's2', name: 'Bravo', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 50, y: 50 },
    { id: 's3', name: 'Charlie', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1', 'L2'], x: 90, y: 50 },
    { id: 's4', name: 'Delta', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'], x: 130, y: 100 },
  ];

  const mockRouteResult: RouteResult = {
    segments: [
      {
        lineId: 'line1',
        lineCode: 'L1',
        lineColor: '#FF0000',
        stopIds: ['s1', 's2', 's3'],
        stopNames: ['Alpha', 'Bravo', 'Charlie'],
        directionName: 'Charlie',
      },
    ],
    transfers: 0,
    transferStopIds: [],
    allStopIds: ['s1', 's2', 's3'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouteSearchBarComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: mapRouteEn, fr: mapRouteEn },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    });

    fixture = TestBed.createComponent(RouteSearchBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('stops', mockStops);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render departure and arrival form fields', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const inputs = fixture.nativeElement.querySelectorAll('input[matInput]');
    expect(inputs.length).toBe(2);
  });

  it('should render the route search panel', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = fixture.nativeElement.querySelector('.route-search-panel');
    expect(panel).toBeTruthy();

    const title = fixture.nativeElement.querySelector('.panel-title');
    expect(title.textContent.trim()).toBe('Route');
  });

  it('should display all stops when no filter is typed', () => {
    fixture.detectChanges();

    const filtered = component.filteredDepartures();
    expect(filtered.length).toBe(mockStops.length);
  });

  it('should filter stops based on typed text', () => {
    fixture.detectChanges();

    component.departureCtrl.setValue('alp');
    fixture.detectChanges();

    const filtered = component.filteredDepartures();
    expect(filtered.length).toBe(1);
    expect(filtered[0]!.name).toBe('Alpha');
  });

  it('should display stop name using displayFn', () => {
    const stop = mockStops[0]!;
    expect(component.displayFn(stop)).toBe('Alpha');
    expect(component.displayFn('some string')).toBe('some string');
    expect(component.displayFn(null as unknown as string)).toBe('');
    expect(component.displayFn('')).toBe('');
  });

  it('should detect same stop error', () => {
    fixture.detectChanges();

    component.selectedDeparture.set(mockStops[0]!);
    component.selectedArrival.set(mockStops[0]!);

    expect(component.sameStopError()).toBe(true);
  });

  it('should not flag same stop error for different stops', () => {
    fixture.detectChanges();

    component.selectedDeparture.set(mockStops[0]!);
    component.selectedArrival.set(mockStops[1]!);

    expect(component.sameStopError()).toBe(false);
  });

  it('should not flag same stop error when one is null', () => {
    fixture.detectChanges();

    component.selectedDeparture.set(mockStops[0]!);
    component.selectedArrival.set(null);

    expect(component.sameStopError()).toBe(false);
  });

  describe('noRouteFound', () => {
    it('flags an unreachable route once both endpoints are picked but the result is null', () => {
      fixture.detectChanges();

      component.selectedDeparture.set(mockStops[0]!);
      component.selectedArrival.set(mockStops[3]!);
      // routeResult input still defaults to null — simulates router returning no path
      expect(component.noRouteFound()).toBe(true);
    });

    it('clears the warning once a route is delivered', () => {
      fixture.componentRef.setInput('routeResult', mockRouteResult);
      fixture.detectChanges();

      component.selectedDeparture.set(mockStops[0]!);
      component.selectedArrival.set(mockStops[2]!);

      expect(component.noRouteFound()).toBe(false);
    });

    it('does not warn while only one endpoint is selected', () => {
      fixture.detectChanges();

      component.selectedDeparture.set(mockStops[0]!);
      component.selectedArrival.set(null);

      expect(component.noRouteFound()).toBe(false);
    });

    it('does not warn when both endpoints are the same stop', () => {
      fixture.detectChanges();

      component.selectedDeparture.set(mockStops[0]!);
      component.selectedArrival.set(mockStops[0]!);

      expect(component.noRouteFound()).toBe(false);
      expect(component.sameStopError()).toBe(true);
    });

    it('renders the warning hint in the panel', async () => {
      // Drive the warning the same way the parent does — through inputs —
      // so the sync effect leaves selectedDeparture/Arrival in place.
      fixture.componentRef.setInput('departureStop', mockStops[0]!);
      fixture.componentRef.setInput('arrivalStop', mockStops[3]!);
      fixture.componentRef.setInput('routeResult', null);
      fixture.detectChanges();
      await fixture.whenStable();

      const hint = fixture.nativeElement.querySelector('.error-hint-warning');
      expect(hint).toBeTruthy();
      expect(hint.textContent).toContain('No route found');
    });
  });

  describe('swapStops', () => {
    it('should swap departure and arrival selections', () => {
      fixture.detectChanges();

      component.selectedDeparture.set(mockStops[0]!);
      component.selectedArrival.set(mockStops[1]!);

      component.swapStops();

      expect(component.selectedDeparture()?.id).toBe('s2');
      expect(component.selectedArrival()?.id).toBe('s1');
    });

    it('should emit departureChanged and arrivalChanged on swap', () => {
      fixture.detectChanges();

      const depSpy = vi.fn();
      const arrSpy = vi.fn();
      component.departureChanged.subscribe(depSpy);
      component.arrivalChanged.subscribe(arrSpy);

      component.selectedDeparture.set(mockStops[0]!);
      component.selectedArrival.set(mockStops[1]!);

      component.swapStops();

      expect(depSpy).toHaveBeenCalledWith(mockStops[1]);
      expect(arrSpy).toHaveBeenCalledWith(mockStops[0]);
    });
  });

  describe('clearSearch', () => {
    it('should clear both selections and emit events', () => {
      fixture.detectChanges();

      const depSpy = vi.fn();
      const arrSpy = vi.fn();
      const clearSpy = vi.fn();
      component.departureChanged.subscribe(depSpy);
      component.arrivalChanged.subscribe(arrSpy);
      component.clearRoute.subscribe(clearSpy);

      component.selectedDeparture.set(mockStops[0]!);
      component.selectedArrival.set(mockStops[1]!);

      component.clearSearch();

      expect(component.selectedDeparture()).toBeNull();
      expect(component.selectedArrival()).toBeNull();
      expect(depSpy).toHaveBeenCalledWith(null);
      expect(arrSpy).toHaveBeenCalledWith(null);
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('toggleSegment', () => {
    it('should toggle segment expansion state', () => {
      fixture.detectChanges();

      expect(component.expandedSegments().has(0)).toBe(false);

      component.toggleSegment(0);
      expect(component.expandedSegments().has(0)).toBe(true);

      component.toggleSegment(0);
      expect(component.expandedSegments().has(0)).toBe(false);
    });
  });

  describe('route breakdown display', () => {
    it('should not show route breakdown when no route result', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const breakdown = fixture.nativeElement.querySelector('.route-breakdown');
      expect(breakdown).toBeFalsy();
    });

    it('should show route breakdown when route result is provided', async () => {
      fixture.componentRef.setInput('routeResult', mockRouteResult);
      fixture.detectChanges();
      await fixture.whenStable();

      const breakdown = fixture.nativeElement.querySelector('.route-breakdown');
      expect(breakdown).toBeTruthy();

      const badge = fixture.nativeElement.querySelector('.segment-badge');
      expect(badge.textContent.trim()).toBe('L1');
    });
  });

  describe('clear button visibility', () => {
    it('should not show clear button when no stops selected', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const clearBtn = fixture.nativeElement.querySelector('.panel-header .clear-btn');
      expect(clearBtn).toBeFalsy();
    });

    it('should show clear button when departure is selected', async () => {
      fixture.componentRef.setInput('departureStop', mockStops[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      const clearBtn = fixture.nativeElement.querySelector('.panel-header .clear-btn');
      expect(clearBtn).toBeTruthy();
    });
  });
});
