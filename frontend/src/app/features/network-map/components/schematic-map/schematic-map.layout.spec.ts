import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutStop } from '../../services/schematic-layout.service';
import { NetworkLine } from '@shared/models';
import { SchematicMapComponent } from './schematic-map.component';
import {
  MOCK_STOPS,
  ROUTE_S1_S2_S3,
  setupSchematicMapFixture,
} from './schematic-map-spec.helpers';

/**
 * Visual layout / rendering checks for the schematic map. Split from
 * the main spec to keep each file under the 600-line file-size
 * guardrail. Covers everything that touches SVG geometry — empty
 * state, alert overlay severity, URL sync, label rendering, route
 * paths, filter overlays — leaving signal / interaction / keyboard
 * tests in `schematic-map.component.spec.ts`.
 */
describe('SchematicMapComponent — layout & rendering', () => {
  let component: SchematicMapComponent;
  let fixture: ComponentFixture<SchematicMapComponent>;

  // Aliased so the extracted blocks reference the same identifiers
  // they used in the original spec — keeps the diff small.
  const mockStops = MOCK_STOPS;
  const routeS1S2S3 = ROUTE_S1_S2_S3;

  beforeEach(() => {
    ({ component, fixture } = setupSchematicMapFixture());
  });

  describe('empty selection state', () => {
    it('should show empty selection message when no lines visible', async () => {
      fixture.componentRef.setInput('visibleLineCodes', []);
      fixture.detectChanges();
      await fixture.whenStable();

      const emptyEl = fixture.nativeElement.querySelector('app-empty-state .empty-title');
      expect(emptyEl.textContent).toContain('Select a line');
    });
  });

  describe('line alert severity', () => {
    it('should not list lines with no alerts in the severity map', () => {
      fixture.detectChanges();

      expect(component.lineAlertSeverityMap().has('line1')).toBe(false);
    });

    it('should expose highest severity for lines with alerts', () => {
      fixture.componentRef.setInput('alerts', {
        networkAlerts: [],
        lineAlerts: {
          'line1': [
            { title: 'Info', content: '', severity: 'INFO' as const },
            { title: 'Critical', content: '', severity: 'CRITICAL' as const },
          ],
        },
        stopAlerts: {},
      });
      fixture.detectChanges();

      expect(component.lineAlertSeverityMap().get('line1')).toBe('CRITICAL');
    });
  });

  describe('URL ↔ pan/zoom sync', () => {
    it('writes ?z when the user zooms in', async () => {
      fixture.detectChanges();

      component.zoomIn();
      fixture.detectChanges();
      await fixture.whenStable();

      const url = TestBed.inject(Router).url;
      expect(url).toMatch(/[?&]z=/);
    });

    it('omits ?z and ?p once the view is reset to default', async () => {
      fixture.detectChanges();

      component.zoomIn();
      fixture.detectChanges();
      await fixture.whenStable();

      component.resetView();
      fixture.detectChanges();
      await fixture.whenStable();

      const url = TestBed.inject(Router).url;
      expect(url).not.toMatch(/[?&]z=/);
      expect(url).not.toMatch(/[?&]p=/);
    });
  });

  describe('zoom-invariant label transforms', () => {
    it('produces neutral scale at default zoom = 1', () => {
      fixture.detectChanges();
      // Default reset view sets zoomLevel ≈ 1 — labels render at their CSS size.
      expect(component.labelTransformUp()).toContain('scale(1)');
      expect(component.labelTransformDown()).toContain('scale(1)');
    });

    it('inverts the scale once the user zooms in', () => {
      fixture.detectChanges();

      // Simulate a 2× zoom-in by halving the viewBox width.
      component.zoomIn();
      const zoom = component.zoomLevel();
      expect(zoom).toBeGreaterThan(1);

      const inv = 1 / zoom;
      expect(component.labelTransformUp()).toContain(`scale(${inv})`);
      expect(component.labelTransformDown()).toContain(`scale(${inv})`);
    });

    it('keeps the up label rotated -45° and the down label rotated +45°', () => {
      fixture.detectChanges();
      expect(component.labelTransformUp()).toMatch(/^rotate\(-45\) /);
      expect(component.labelTransformDown()).toMatch(/^rotate\(45\) /);
    });
  });

  describe('displayLabel', () => {
    it('keeps the full name in single-line mode', () => {
      fixture.componentRef.setInput('visibleLineCodes', ['L1']);
      fixture.detectChanges();

      expect(component.displayLabel('Grenoble, Verdun - Préfecture'))
        .toBe('Grenoble, Verdun - Préfecture');
    });

    it('strips the city prefix in multi-line mode', () => {
      fixture.detectChanges(); // 2 lines visible by default

      expect(component.displayLabel('Grenoble, Verdun - Préfecture'))
        .toBe('Verdun - Préfecture');
      expect(component.displayLabel("Saint-Martin-d'Hères, Paul Mistral"))
        .toBe('Paul Mistral');
    });

    it('returns the original name when there is no comma', () => {
      fixture.detectChanges();

      expect(component.displayLabel('La Poya')).toBe('La Poya');
      expect(component.displayLabel('Oxford')).toBe('Oxford');
    });

    it('falls back to the original name when the part after the comma is empty', () => {
      fixture.detectChanges();

      expect(component.displayLabel('Trailing,')).toBe('Trailing,');
      expect(component.displayLabel('Trailing,   ')).toBe('Trailing,   ');
    });
  });

  describe('label generation', () => {
    it('orients every label up in single-line mode (down is reserved for correspondences)', () => {
      const longerLine: NetworkLine = {
        id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null,
        itineraries: [['a1', 'a2', 'a3', 'a4', 'a5']],
      };
      const longerStops: LayoutStop[] = [
        { id: 'a1', name: 'A1', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 80, y: 500 },
        { id: 'a2', name: 'A2', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 230, y: 500 },
        { id: 'a3', name: 'A3', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 380, y: 500 },
        { id: 'a4', name: 'A4', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 530, y: 500 },
        { id: 'a5', name: 'A5', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 680, y: 500 },
      ];

      fixture.componentRef.setInput('lines', [longerLine]);
      fixture.componentRef.setInput('stops', longerStops);
      fixture.componentRef.setInput('visibleLineCodes', ['L1']);
      fixture.detectChanges();

      const labels = component.networkStopLabels();
      expect(labels.map(l => l.orientation)).toEqual(['up', 'up', 'up', 'up', 'up']);
    });

    it('orients every label up in multi-line mode', () => {
      fixture.detectChanges();
      for (const label of component.networkStopLabels()) {
        expect(label.orientation).toBe('up');
      }
    });

    it('emits a single label per stop, anchored on the top-most row', () => {
      // s2 is shared by line1 (top) and line2: only one label, on line1.
      fixture.detectChanges();
      const labelsForS2 = component.networkStopLabels().filter(l => l.stop.id === 's2');
      expect(labelsForS2.length).toBe(1);
      expect(labelsForS2[0]!.lineId).toBe('line1');
    });
  });

  describe('centerOnStop', () => {
    it('should update the viewBox when centering on a valid stop', () => {
      fixture.detectChanges();

      const viewBoxBefore = component.currentViewBox();

      component.centerOnStop('s2');

      const viewBoxAfter = component.currentViewBox();
      expect(viewBoxAfter).not.toBe(viewBoxBefore);
    });

    it('should not change viewBox when centering on a non-existent stop', () => {
      fixture.detectChanges();

      // Reset view first to get a stable baseline
      component.resetView();
      const viewBoxBefore = component.currentViewBox();

      component.centerOnStop('non-existent');

      expect(component.currentViewBox()).toBe(viewBoxBefore);
    });
  });

  describe('route overlay paths', () => {
    it('should return path data when routeResult has segments matching stop IDs', () => {
      fixture.componentRef.setInput('routeResult', routeS1S2S3);
      fixture.detectChanges();

      const overlays = component.routeOverlayPaths();
      expect(overlays.length).toBeGreaterThan(0);
      expect(overlays[0]!.lineId).toBe('line1');
      expect(overlays[0]!.color).toBe('#FF0000');
      expect(overlays[0]!.path).toContain('M ');
      expect(overlays[0]!.path).toContain('L ');
    });
  });

  describe('route direction arrows', () => {
    it('should return arrow data when routeResult has segments', () => {
      fixture.componentRef.setInput('routeResult', routeS1S2S3);
      fixture.detectChanges();

      const arrows = component.routeDirectionArrows();
      expect(arrows.length).toBeGreaterThan(0);
      expect(arrows[0]).toHaveProperty('x');
      expect(arrows[0]).toHaveProperty('y');
      expect(arrows[0]).toHaveProperty('right');
      expect(arrows[0]).toHaveProperty('color');
    });
  });

  describe('departure and arrival marker positions', () => {
    it('should locate departure stop in networkLineRows when departureStopId is set', () => {
      fixture.componentRef.setInput('departureStopId', 's1');
      fixture.componentRef.setInput('arrivalStopId', 's3');
      fixture.componentRef.setInput('routeResult', routeS1S2S3);
      fixture.detectChanges();

      // Verify that networkLineRows contain the departure and arrival stops
      // so the template can render markers at the correct positions
      const rows = component.networkLineRows();
      const allRowStops = rows.flatMap(r => r.stops);

      const departureEntry = allRowStops.find(s => s.stop.id === 's1');
      expect(departureEntry!.x).toBeDefined();

      const arrivalEntry = allRowStops.find(s => s.stop.id === 's3');
      expect(arrivalEntry!.x).toBeDefined();
    });

    it('should correctly report active stops on the route line', () => {
      fixture.componentRef.setInput('departureStopId', 's1');
      fixture.componentRef.setInput('arrivalStopId', 's3');
      fixture.componentRef.setInput('routeResult', routeS1S2S3);
      fixture.detectChanges();

      expect(component.isStopActiveOnLine('s1', 'line1')).toBe(true);
      expect(component.isStopActiveOnLine('s3', 'line1')).toBe(true);
      expect(component.isStopActiveOnLine('s4', 'line1')).toBe(false);
    });
  });

  describe('accessibility filter', () => {
    it('defaults to disabled', () => {
      fixture.detectChanges();
      expect(component.accessibleOnly()).toBe(false);
    });

    it('isStopAccessible returns true only for explicit ACCESSIBLE — UNKNOWN must err on the cautious side', () => {
      fixture.detectChanges();

      const accessible: LayoutStop = { ...mockStops[0]!, wheelchairBoarding: 'ACCESSIBLE' };
      const inaccessible: LayoutStop = { ...mockStops[0]!, wheelchairBoarding: 'NOT_ACCESSIBLE' };
      const unknown: LayoutStop = { ...mockStops[0]!, wheelchairBoarding: 'UNKNOWN' };
      const missing: LayoutStop = { ...mockStops[0]! };

      expect(component.isStopAccessible(accessible)).toBe(true);
      expect(component.isStopAccessible(inaccessible)).toBe(false);
      expect(component.isStopAccessible(unknown)).toBe(false);
      expect(component.isStopAccessible(missing)).toBe(false);
    });

    it('toggling accessibleOnly flips the signal', () => {
      fixture.detectChanges();
      expect(component.accessibleOnly()).toBe(false);
      component.accessibleOnly.set(true);
      expect(component.accessibleOnly()).toBe(true);
      component.accessibleOnly.set(false);
      expect(component.accessibleOnly()).toBe(false);
    });
  });

  describe('zone filter', () => {
    it('defaults to no zone selected', () => {
      fixture.detectChanges();
      expect(component.selectedZone()).toBeNull();
    });

    it('isStopInSelectedZone returns true for every stop when no zone is selected', () => {
      fixture.detectChanges();
      const stopWithZones: LayoutStop = { ...mockStops[0]!, fareAreaNames: ['Zone 1'] };
      const stopWithoutZones: LayoutStop = { ...mockStops[0]! };

      expect(component.isStopInSelectedZone(stopWithZones)).toBe(true);
      expect(component.isStopInSelectedZone(stopWithoutZones)).toBe(true);
    });

    it('isStopInSelectedZone matches a stop whose fareAreaNames contains the selected zone', () => {
      fixture.detectChanges();
      component.selectedZone.set('Zone 2');

      const inside: LayoutStop = { ...mockStops[0]!, fareAreaNames: ['Zone 1', 'Zone 2'] };
      const outside: LayoutStop = { ...mockStops[0]!, fareAreaNames: ['Zone 1'] };
      const noZones: LayoutStop = { ...mockStops[0]! };

      expect(component.isStopInSelectedZone(inside)).toBe(true);
      expect(component.isStopInSelectedZone(outside)).toBe(false);
      expect(component.isStopInSelectedZone(noZones)).toBe(false);
    });

    it('availableZones is empty when the loaded feed has no fare zones', () => {
      fixture.detectChanges();
      expect(component.availableZones()).toEqual([]);
    });

    it('availableZones returns the sorted, deduped union of fareAreaNames across stops', () => {
      const zonedStops: LayoutStop[] = [
        { ...mockStops[0]!, fareAreaNames: ['Zone 2', 'Zone 1'] },
        { ...mockStops[1]!, fareAreaNames: ['Zone 3'] },
        { ...mockStops[2]!, fareAreaNames: ['Zone 1'] },
        { ...mockStops[3]! },
        { ...mockStops[4]!, fareAreaNames: ['Zone 2'] },
      ];
      fixture.componentRef.setInput('stops', zonedStops);
      fixture.detectChanges();

      expect(component.availableZones()).toEqual(['Zone 1', 'Zone 2', 'Zone 3']);
    });
  });

  describe('fare-zone color overlay', () => {
    it('zoneOverlayVisible defaults to false', () => {
      fixture.detectChanges();
      expect(component.zoneOverlayVisible()).toBe(false);
    });

    it('zoneColorFor returns the same hsl color for the same zone name', () => {
      fixture.detectChanges();
      expect(component.zoneColorFor('Zone 1')).toBe(component.zoneColorFor('Zone 1'));
      expect(component.zoneColorFor('Zone 1')).toMatch(/^hsl\(\d+, 60%, 55%\)$/);
    });

    it('zoneColorFor produces different colors for different zone names', () => {
      fixture.detectChanges();
      const a = component.zoneColorFor('Zone 1');
      const b = component.zoneColorFor('Zone 2');
      const c = component.zoneColorFor('Suburban');
      expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2);
    });

    it('stopZoneColor returns null when the stop has no fare zones', () => {
      fixture.detectChanges();
      const stop: LayoutStop = { ...mockStops[0]! };
      expect(component.stopZoneColor(stop)).toBeNull();
    });

    it('stopZoneColor picks the alphabetically-first zone for stable coloring', () => {
      fixture.detectChanges();
      const stop1: LayoutStop = { ...mockStops[0]!, fareAreaNames: ['Zone B', 'Zone A', 'Zone C'] };
      const stop2: LayoutStop = { ...mockStops[0]!, fareAreaNames: ['Zone A'] };
      // Both stops should map to the same colour because both pick "Zone A".
      expect(component.stopZoneColor(stop1)).toBe(component.stopZoneColor(stop2));
    });

    it('toggling zoneOverlayVisible flips the signal', () => {
      fixture.detectChanges();
      expect(component.zoneOverlayVisible()).toBe(false);
      component.zoneOverlayVisible.set(true);
      expect(component.zoneOverlayVisible()).toBe(true);
    });
  });

  describe('frequency-scaled stroke width', () => {
    function lineWith(scheduleCount: number, code = 'LX'): NetworkLine {
      return {
        id: `id-${code}`, code, name: code, color: '#000', type: 'BUS',
        itineraries: [['s1', 's2']], scheduleCount,
      };
    }

    it('maxLineScheduleCount returns 0 when no line ships a scheduleCount', () => {
      fixture.detectChanges();
      expect(component.maxLineScheduleCount()).toBe(0);
    });

    it('maxLineScheduleCount returns the highest scheduleCount across the loaded lines', () => {
      const lines = [lineWith(120, 'LA'), lineWith(35, 'LB'), lineWith(800, 'LC')];
      fixture.componentRef.setInput('lines', lines);
      fixture.componentRef.setInput('visibleLineCodes', ['LA', 'LB', 'LC']);
      fixture.detectChanges();

      expect(component.maxLineScheduleCount()).toBe(800);
    });

    it('busy line strokes wider than a sleepy line of the same mode', () => {
      const busy = lineWith(2_000, 'LA');
      const sleepy = lineWith(20, 'LB');
      fixture.componentRef.setInput('lines', [busy, sleepy]);
      fixture.componentRef.setInput('visibleLineCodes', ['LA', 'LB']);
      fixture.detectChanges();

      expect(component.getLineStrokeWidth(busy)).toBeGreaterThan(component.getLineStrokeWidth(sleepy));
      expect(component.getRouteStrokeWidth(busy.id)).toBeGreaterThan(component.getRouteStrokeWidth(sleepy.id));
    });

    it('falls back to a constant width in single-line mode (frequency scaling only matters in network view)', () => {
      const busy = lineWith(5_000, 'LA');
      fixture.componentRef.setInput('lines', [busy]);
      fixture.componentRef.setInput('visibleLineCodes', ['LA']);
      fixture.detectChanges();

      expect(component.isSingleLineMode()).toBe(true);
      expect(component.getLineStrokeWidth(busy)).toBe(8);
      expect(component.getRouteStrokeWidth(busy.id)).toBe(10);
    });

    it('a missing scheduleCount lands on the lower 0.75× bound, never blowing up the visible weight', () => {
      const busy = lineWith(1_000, 'LA');
      const empty: NetworkLine = {
        id: 'id-LB', code: 'LB', name: 'LB', color: '#000', type: 'BUS',
        itineraries: [['s4', 's5']],
      };
      fixture.componentRef.setInput('lines', [busy, empty]);
      fixture.componentRef.setInput('visibleLineCodes', ['LA', 'LB']);
      fixture.detectChanges();

      // Bus base = 7, low-bound multiplier = 0.75 → round(5.25) = 5.
      expect(component.getLineStrokeWidth(empty)).toBe(5);
    });
  });
});
