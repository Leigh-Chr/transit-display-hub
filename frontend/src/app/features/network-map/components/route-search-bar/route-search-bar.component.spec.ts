import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testTranslocoModule } from '../../../../../test-translations';
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
        testTranslocoModule(mapRouteEn),
      ],
    });

    fixture = TestBed.createComponent(RouteSearchBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('stops', mockStops);
  });

  it('renders the panel with two embedded stop autocompletes', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = fixture.nativeElement.querySelector('.route-search-panel');
    expect(panel).not.toBeNull();

    const autocompletes = fixture.nativeElement.querySelectorAll('app-stop-autocomplete');
    expect(autocompletes.length).toBe(2);

    const title = fixture.nativeElement.querySelector('.panel-title');
    expect(title.textContent.trim()).toBe('Route');
  });

  it('detects same-stop selection', () => {
    fixture.detectChanges();

    component.selectedDeparture.set(mockStops[0]!);
    component.selectedArrival.set(mockStops[0]!);

    expect(component.sameStopError()).toBe(true);
  });

  it('does not flag same-stop for distinct selections', () => {
    fixture.detectChanges();

    component.selectedDeparture.set(mockStops[0]!);
    component.selectedArrival.set(mockStops[1]!);

    expect(component.sameStopError()).toBe(false);
  });

  it('does not flag same-stop when one side is null', () => {
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
      fixture.componentRef.setInput('departureStop', mockStops[0]!);
      fixture.componentRef.setInput('arrivalStop', mockStops[3]!);
      fixture.componentRef.setInput('routeResult', null);
      fixture.detectChanges();
      await fixture.whenStable();

      const hint = fixture.nativeElement.querySelector('.error-hint-warning');
      expect(hint.textContent).toContain('No route found');
    });
  });

  describe('onDepartureSelected / onArrivalSelected', () => {
    it('emits searchRoute when both endpoints are picked through the autocomplete', () => {
      fixture.detectChanges();
      const searchSpy = vi.fn();
      component.searchRoute.subscribe(searchSpy);

      component.onDepartureSelected(mockStops[0]!);
      component.onArrivalSelected(mockStops[1]!);

      expect(searchSpy).toHaveBeenCalledWith({ from: 's1', to: 's2' });
    });

    it('emits departureChanged with the picked stop', () => {
      fixture.detectChanges();
      const depSpy = vi.fn();
      component.departureChanged.subscribe(depSpy);

      component.onDepartureSelected(mockStops[2]!);

      expect(depSpy).toHaveBeenCalledWith(mockStops[2]);
    });

    it('does not emit searchRoute when both endpoints are the same stop', () => {
      fixture.detectChanges();
      const searchSpy = vi.fn();
      component.searchRoute.subscribe(searchSpy);

      component.onDepartureSelected(mockStops[0]!);
      component.onArrivalSelected(mockStops[0]!);

      expect(searchSpy).not.toHaveBeenCalled();
    });
  });

  describe('swapStops', () => {
    it('swaps departure and arrival selections', () => {
      fixture.detectChanges();

      component.selectedDeparture.set(mockStops[0]!);
      component.selectedArrival.set(mockStops[1]!);

      component.swapStops();

      expect(component.selectedDeparture()?.id).toBe('s2');
      expect(component.selectedArrival()?.id).toBe('s1');
    });

    it('emits departureChanged and arrivalChanged on swap', () => {
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
    it('clears both selections and emits the corresponding events', () => {
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
    it('toggles the expansion state for a given segment index', () => {
      fixture.detectChanges();

      expect(component.expandedSegments().has(0)).toBe(false);

      component.toggleSegment(0);
      expect(component.expandedSegments().has(0)).toBe(true);

      component.toggleSegment(0);
      expect(component.expandedSegments().has(0)).toBe(false);
    });
  });

  describe('route breakdown display', () => {
    it('hides the breakdown when no route result is set', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const breakdown = fixture.nativeElement.querySelector('.route-breakdown');
      expect(breakdown).toBeFalsy();
    });

    it('renders the breakdown when a route result is provided', async () => {
      fixture.componentRef.setInput('routeResult', mockRouteResult);
      fixture.detectChanges();
      await fixture.whenStable();

      const breakdown = fixture.nativeElement.querySelector('.route-breakdown');
      expect(breakdown).not.toBeNull();

      const badge = fixture.nativeElement.querySelector('.segment-badge');
      expect(badge.textContent.trim()).toBe('L1');
    });
  });

  describe('clear button visibility', () => {
    it('hides the clear button when no endpoints are picked', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const clearBtn = fixture.nativeElement.querySelector('.panel-header .clear-btn');
      expect(clearBtn).toBeFalsy();
    });

    it('shows the clear button when departureStop input is set', async () => {
      fixture.componentRef.setInput('departureStop', mockStops[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      const clearBtn = fixture.nativeElement.querySelector('.panel-header .clear-btn');
      expect(clearBtn).not.toBeNull();
    });
  });
});
