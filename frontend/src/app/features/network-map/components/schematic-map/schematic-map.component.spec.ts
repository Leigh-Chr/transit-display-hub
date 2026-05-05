import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchematicMapComponent } from './schematic-map.component';
import { LayoutStop } from '../../services/schematic-layout.service';
import { NetworkLine } from '@shared/models';

describe('SchematicMapComponent', () => {
  let component: SchematicMapComponent;
  let fixture: ComponentFixture<SchematicMapComponent>;

  const mockStops: LayoutStop[] = [
    { id: 's1', name: 'Alpha', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 80, y: 500 },
    { id: 's2', name: 'Transfer', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1', 'L2'], x: 500, y: 500 },
    { id: 's3', name: 'Bravo', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'], x: 920, y: 500 },
    { id: 's4', name: 'Charlie', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'], x: 80, y: 600 },
    { id: 's5', name: 'Delta', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'], x: 920, y: 600 },
  ];

  const mockLines: NetworkLine[] = [
    { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, itineraries: [['s1', 's2', 's3']] },
    { id: 'line2', code: 'L2', name: 'Line 2', color: '#0000FF', type: null, itineraries: [['s4', 's2', 's5']] },
  ];

  const mockLineColorMap = new Map<string, string>([
    ['L1', '#FF0000'],
    ['L2', '#0000FF'],
  ]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SchematicMapComponent],
      providers: [provideRouter([])], // ngxtension's linkedQueryParam needs ActivatedRoute
    });

    fixture = TestBed.createComponent(SchematicMapComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('lines', mockLines);
    fixture.componentRef.setInput('stops', mockStops);
    fixture.componentRef.setInput('lineColorMap', mockLineColorMap);
    fixture.componentRef.setInput('visibleLineCodes', ['L1', 'L2']);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should compute sortedLines alphabetically/numerically', () => {
    fixture.detectChanges();

    const sorted = component.sortedLines();
    expect(sorted.length).toBe(2);
    expect(sorted[0]!.code).toBe('L1');
    expect(sorted[1]!.code).toBe('L2');
  });

  it('should compute visibleCodeSet from input', () => {
    fixture.detectChanges();

    const set = component.visibleCodeSet();
    expect(set.has('L1')).toBe(true);
    expect(set.has('L2')).toBe(true);
  });

  it('should detect single line mode', () => {
    fixture.componentRef.setInput('visibleLineCodes', ['L1']);
    fixture.detectChanges();

    expect(component.isSingleLineMode()).toBe(true);
  });

  it('should not be single line mode with multiple visible lines', () => {
    fixture.detectChanges();

    expect(component.isSingleLineMode()).toBe(false);
  });

  it('should detect interchange stops', () => {
    fixture.detectChanges();

    const interchangeStop = mockStops[1]!; // Transfer - has two line codes
    const normalStop = mockStops[0]!; // Alpha - has one line code

    expect(component.isInterchange(interchangeStop)).toBe(true);
    expect(component.isInterchange(normalStop)).toBe(false);
  });

  it('should compute hasHiddenLines when some lines are not visible', () => {
    fixture.componentRef.setInput('visibleLineCodes', ['L1']);
    fixture.detectChanges();

    expect(component.hasHiddenLines()).toBe(true);
  });

  it('should compute hasHiddenLines as false when all lines visible', () => {
    fixture.detectChanges();

    expect(component.hasHiddenLines()).toBe(false);
  });

  describe('filter methods', () => {
    it('should emit filterChange when toggling a line', () => {
      fixture.detectChanges();

      const spy = vi.fn();
      component.filterChange.subscribe(spy);

      component.toggleLine('L1');

      expect(spy).toHaveBeenCalledWith(['L2']);
    });

    it('should emit filterChange with all codes when toggling all (currently all visible)', () => {
      fixture.detectChanges();

      const spy = vi.fn();
      component.filterChange.subscribe(spy);

      component.toggleAllLines();

      // When all are visible, toggling all should select none
      expect(spy).toHaveBeenCalledWith([]);
    });

    it('should emit filterChange with all codes when toggling all (currently none visible)', () => {
      fixture.componentRef.setInput('visibleLineCodes', []);
      fixture.detectChanges();

      const spy = vi.fn();
      component.filterChange.subscribe(spy);

      component.toggleAllLines();

      expect(spy).toHaveBeenCalledWith(['L1', 'L2']);
    });

    it('should emit only the specified line code when using showOnlyLine', () => {
      fixture.detectChanges();

      const spy = vi.fn();
      component.filterChange.subscribe(spy);

      component.showOnlyLine('L2');

      expect(spy).toHaveBeenCalledWith(['L2']);
    });
  });

  describe('stop interaction', () => {
    it('should emit stopSelected when a stop is clicked', () => {
      fixture.detectChanges();

      const spy = vi.fn();
      component.stopSelected.subscribe(spy);

      const mockEvent = { stopPropagation: vi.fn() } as unknown as Event;
      component.onStopClick(mockStops[0]!, mockEvent);

      expect(spy).toHaveBeenCalledWith(mockStops[0]!);
      expect((mockEvent as unknown as { stopPropagation: ReturnType<typeof vi.fn> }).stopPropagation).toHaveBeenCalled();
    });
  });

  describe('helper methods', () => {
    it('should return correct line badge width', () => {
      // min 64 SVG units, 14 per char + 24 above the floor
      expect(component.getLineBadgeWidth('L1')).toBe(64);
      expect(component.getLineBadgeWidth('LONG')).toBe(80);
    });

    it('should return correct line color', () => {
      fixture.detectChanges();

      expect(component.getLineColor('L1')).toBe('#FF0000');
      expect(component.getLineColor('MISSING')).toBe('#666');
    });

    it('should return correct transport icon path for known types', () => {
      expect(component.getTransportIcon('TRAIN')).toContain('M12 2C8');
      expect(component.getTransportIcon('METRO')).toContain('M17.8');
      expect(component.getTransportIcon('BUS')).toContain('M4 16');
      expect(component.getTransportIcon('TRAM')).toContain('M13 5');
      expect(component.getTransportIcon('UNKNOWN')).toBe('');
    });

    it('should return correct alert offset based on mode', () => {
      fixture.componentRef.setInput('visibleLineCodes', ['L1']);
      fixture.detectChanges();
      expect(component.getAlertOffset()).toBe(10);

      fixture.componentRef.setInput('visibleLineCodes', ['L1', 'L2']);
      fixture.detectChanges();
      expect(component.getAlertOffset()).toBe(12);
    });

    it('should compute badge transform correctly', () => {
      const transform = component.getBadgeTransform(0, 3);
      expect(transform).toContain('translate(');
    });

    it('should detect stop alerts', () => {
      fixture.componentRef.setInput('alerts', {
        networkAlerts: [],
        lineAlerts: {},
        stopAlerts: { 's1': [{ title: 'Test', content: '', severity: 'INFO' as const }] },
      });
      fixture.detectChanges();

      expect(component.hasStopAlerts()).toBe(true);
    });

    it('should return false for hasStopAlerts when none exist', () => {
      fixture.detectChanges();

      expect(component.hasStopAlerts()).toBe(false);
    });
  });

  describe('route overlay', () => {
    it('should detect route when routeResult is set', () => {
      fixture.componentRef.setInput('routeResult', {
        segments: [{
          lineId: 'line1',
          lineCode: 'L1',
          lineColor: '#FF0000',
          stopIds: ['s1', 's2'],
          stopNames: ['Alpha', 'Transfer'],
          directionName: 'Bravo',
        }],
        transfers: 0,
        transferStopIds: [],
        allStopIds: ['s1', 's2'],
      });
      fixture.detectChanges();

      expect(component.hasRoute()).toBe(true);
    });

    it('should not detect route when routeResult is null', () => {
      fixture.detectChanges();

      expect(component.hasRoute()).toBe(false);
    });

    it('should compute route transfer IDs', () => {
      fixture.componentRef.setInput('routeResult', {
        segments: [],
        transfers: 1,
        transferStopIds: ['s2'],
        allStopIds: ['s1', 's2', 's4'],
      });
      fixture.detectChanges();

      expect(component.routeTransferIds().has('s2')).toBe(true);
    });
  });

  describe('zoom controls', () => {
    it('should toggle panning state', () => {
      fixture.detectChanges();

      expect(component.isPanning()).toBe(false);

      component.onPointerUp();
      expect(component.isPanning()).toBe(false);
    });
  });

  describe('vertical row spacing', () => {
    it('keeps a 120-unit pitch between rows on a small network', () => {
      fixture.detectChanges();
      const rows = component.networkLineRows();
      // Default mock has two rows.
      expect(rows[1]!.y - rows[0]!.y).toBeCloseTo(120);
    });

    it('keeps the 120-unit pitch even when many lines are visible (no compression)', () => {
      const lines: NetworkLine[] = Array.from({ length: 20 }, (_, i) => ({
        id: `l${i}`, code: `L${i}`, name: `Line ${i}`, color: '#000', type: null,
        itineraries: [['shared', `s${i}-end`]],
      }));
      const stopsForLines: LayoutStop[] = [
        { id: 'shared', name: 'Shared', latitude: null, longitude: null, schematicX: null, schematicY: null,
          lineCodes: lines.map(l => l.code), x: 0, y: 0 },
        ...lines.map((_, i) => ({
          id: `s${i}-end`, name: `End ${i}`, latitude: null, longitude: null,
          schematicX: null, schematicY: null, lineCodes: [`L${i}`], x: 0, y: 0,
        })),
      ];

      fixture.componentRef.setInput('lines', lines);
      fixture.componentRef.setInput('stops', stopsForLines);
      fixture.componentRef.setInput('visibleLineCodes', lines.map(l => l.code));
      fixture.detectChanges();

      const rows = component.networkLineRows();
      expect(rows.length).toBe(20);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.y - rows[i - 1]!.y).toBeCloseTo(120);
      }
    });
  });

  describe('horizontal spacing', () => {
    it('keeps the default 840 inner extent for short lines', () => {
      fixture.detectChanges();
      const rows = component.networkLineRows();
      const xs = rows[0]!.stops.map(s => s.x);
      // Mock data has 3 stops on line1 at positions {80, 500, 920} → first/last
      // pinned at the canvas edges.
      expect(Math.min(...xs)).toBeCloseTo(80);
      expect(Math.max(...xs)).toBeCloseTo(920);
    });

    it('expands the inner extent so adjacent stops stay at least MIN_STOP_SPACING apart on long lines', () => {
      const stopCount = 30;
      const longStops: LayoutStop[] = Array.from({ length: stopCount }, (_, i) => ({
        id: `s${i}`, name: `Stop ${i}`, latitude: null, longitude: null,
        schematicX: null, schematicY: null, lineCodes: ['LX'], x: 0, y: 0,
      }));
      const longLine: NetworkLine = {
        id: 'lineX', code: 'LX', name: 'Long line', color: '#000', type: null,
        itineraries: [longStops.map(s => s.id)],
      };

      fixture.componentRef.setInput('lines', [longLine]);
      fixture.componentRef.setInput('stops', longStops);
      fixture.componentRef.setInput('visibleLineCodes', ['LX']);
      fixture.detectChanges();

      const rows = component.networkLineRows();
      const xs = rows[0]!.stops.map(s => s.x);
      // 30 stops × MIN_STOP_SPACING (50) = 1450 inner extent → first stop
      // sits at the padding (80), last at 80 + 1450 = 1530.
      expect(xs[0]).toBeCloseTo(80);
      expect(xs[xs.length - 1]!).toBeGreaterThanOrEqual(80 + 50 * (stopCount - 1) - 0.001);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(50 - 0.001);
      }
    });
  });

  describe('line text color contrast', () => {
    it('returns dark text on bright brand colors', () => {
      // RATP-style yellow: too bright for white text
      expect(component.getLineTextColor('#FFCD00')).toBe('#1a1a1a');
      // Pastel green
      expect(component.getLineTextColor('#bdf')).toBe('#1a1a1a');
    });

    it('returns white text on dark brand colors', () => {
      expect(component.getLineTextColor('#003366')).toBe('#fff');
      expect(component.getLineTextColor('#000')).toBe('#fff');
    });

    it('falls back to white for malformed input', () => {
      expect(component.getLineTextColor('')).toBe('#fff');
      expect(component.getLineTextColor('not-a-color')).toBe('#fff');
      expect(component.getLineTextColor('#zzz')).toBe('#fff');
    });
  });

  describe('wheel hint', () => {
    beforeEach(() => {
      try { localStorage.removeItem('transit-hub.wheel-hint-seen'); } catch { /* skip */ }
    });

    function wheel(extra: Partial<WheelEvent>): WheelEvent {
      return {
        deltaX: 0, deltaY: 0, clientX: 100, clientY: 100,
        ctrlKey: false, metaKey: false,
        preventDefault: vi.fn(),
        ...extra,
      } as unknown as WheelEvent;
    }

    it('shows the hint on the first plain wheel scroll', () => {
      fixture.detectChanges();
      expect(component.wheelHintVisible()).toBe(false);
      component.onWheel(wheel({ deltaY: 50 }));
      expect(component.wheelHintVisible()).toBe(true);
    });

    it('does not show the hint on Ctrl+wheel zoom', () => {
      fixture.detectChanges();
      component.onWheel(wheel({ deltaY: -50, ctrlKey: true }));
      expect(component.wheelHintVisible()).toBe(false);
    });

    it('does not re-show the hint once flagged in localStorage', () => {
      fixture.detectChanges();
      component.onWheel(wheel({ deltaY: 50 }));
      expect(component.wheelHintVisible()).toBe(true);

      // Simulate the timer dismissing the hint, then scroll again.
      component.wheelHintVisible.set(false);
      component.onWheel(wheel({ deltaY: 50 }));
      expect(component.wheelHintVisible()).toBe(false);
    });
  });

  describe('keyboard navigation', () => {
    function key(k: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
      return { key: k, shiftKey: false, preventDefault: vi.fn(), ...modifiers } as unknown as KeyboardEvent;
    }

    /** jsdom returns 0×0 for getBoundingClientRect, which makes the
     *  pan-by-screen-pixels code abandon (division-by-zero guard). Force a
     *  realistic rect so the keyboard tests actually exercise the pan. */
    function mockSvgRect(): void {
      const svg = component.svgElement()?.nativeElement;
      if (svg) {
        svg.getBoundingClientRect = (): DOMRect => ({
          left: 0, top: 0, right: 1000, bottom: 800,
          width: 1000, height: 800, x: 0, y: 0, toJSON: () => ({}),
        }) as DOMRect;
      }
    }

    it('shifts the viewBox horizontally on ArrowRight', () => {
      fixture.detectChanges();
      mockSvgRect();
      const before = component.currentViewBox();
      component.onKeyDown(key('ArrowRight'));
      expect(component.currentViewBox()).not.toBe(before);
    });

    it('shifts the viewBox vertically on ArrowDown', () => {
      fixture.detectChanges();
      mockSvgRect();
      const before = component.currentViewBox();
      component.onKeyDown(key('ArrowDown'));
      expect(component.currentViewBox()).not.toBe(before);
    });

    it('zooms in on +', () => {
      fixture.detectChanges();
      const before = component.zoomLevel();
      component.onKeyDown(key('+'));
      expect(component.zoomLevel()).toBeGreaterThan(before);
    });

    it('zooms out on -', () => {
      fixture.detectChanges();
      component.zoomIn();
      const before = component.zoomLevel();
      component.onKeyDown(key('-'));
      expect(component.zoomLevel()).toBeLessThan(before);
    });

    it('resets the view on 0', () => {
      fixture.detectChanges();
      component.zoomIn();
      component.onKeyDown(key('0'));
      // Reset puts zoom back to 1.
      expect(component.zoomLevel()).toBeCloseTo(1, 5);
    });

    it('ignores unrelated keys', () => {
      fixture.detectChanges();
      const before = component.currentViewBox();
      component.onKeyDown(key('a'));
      expect(component.currentViewBox()).toBe(before);
    });

    it('preventDefault is called only on handled keys', () => {
      fixture.detectChanges();
      const handled = key('ArrowUp');
      const unhandled = key('a');
      component.onKeyDown(handled);
      component.onKeyDown(unhandled);
      expect(handled.preventDefault).toHaveBeenCalled();
      expect(unhandled.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('empty selection state', () => {
    it('should show empty selection message when no lines visible', async () => {
      fixture.componentRef.setInput('visibleLineCodes', []);
      fixture.detectChanges();
      await fixture.whenStable();

      const emptyEl = fixture.nativeElement.querySelector('.empty-selection-text');
      expect(emptyEl).toBeTruthy();
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
      fixture.componentRef.setInput('routeResult', {
        segments: [{
          lineId: 'line1',
          lineCode: 'L1',
          lineColor: '#FF0000',
          stopIds: ['s1', 's2', 's3'],
          stopNames: ['Alpha', 'Transfer', 'Bravo'],
          directionName: 'Bravo',
        }],
        transfers: 0,
        transferStopIds: [],
        allStopIds: ['s1', 's2', 's3'],
      });
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
      fixture.componentRef.setInput('routeResult', {
        segments: [{
          lineId: 'line1',
          lineCode: 'L1',
          lineColor: '#FF0000',
          stopIds: ['s1', 's2', 's3'],
          stopNames: ['Alpha', 'Transfer', 'Bravo'],
          directionName: 'Bravo',
        }],
        transfers: 0,
        transferStopIds: [],
        allStopIds: ['s1', 's2', 's3'],
      });
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
      fixture.componentRef.setInput('routeResult', {
        segments: [{
          lineId: 'line1',
          lineCode: 'L1',
          lineColor: '#FF0000',
          stopIds: ['s1', 's2', 's3'],
          stopNames: ['Alpha', 'Transfer', 'Bravo'],
          directionName: 'Bravo',
        }],
        transfers: 0,
        transferStopIds: [],
        allStopIds: ['s1', 's2', 's3'],
      });
      fixture.detectChanges();

      // Verify that networkLineRows contain the departure and arrival stops
      // so the template can render markers at the correct positions
      const rows = component.networkLineRows();
      const allRowStops = rows.flatMap(r => r.stops);

      const departureEntry = allRowStops.find(s => s.stop.id === 's1');
      expect(departureEntry).toBeTruthy();
      expect(departureEntry!.x).toBeDefined();

      const arrivalEntry = allRowStops.find(s => s.stop.id === 's3');
      expect(arrivalEntry).toBeTruthy();
      expect(arrivalEntry!.x).toBeDefined();
    });

    it('should correctly report active stops on the route line', () => {
      fixture.componentRef.setInput('departureStopId', 's1');
      fixture.componentRef.setInput('arrivalStopId', 's3');
      fixture.componentRef.setInput('routeResult', {
        segments: [{
          lineId: 'line1',
          lineCode: 'L1',
          lineColor: '#FF0000',
          stopIds: ['s1', 's2', 's3'],
          stopNames: ['Alpha', 'Transfer', 'Bravo'],
          directionName: 'Bravo',
        }],
        transfers: 0,
        transferStopIds: [],
        allStopIds: ['s1', 's2', 's3'],
      });
      fixture.detectChanges();

      expect(component.isStopActiveOnLine('s1', 'line1')).toBe(true);
      expect(component.isStopActiveOnLine('s3', 'line1')).toBe(true);
      expect(component.isStopActiveOnLine('s4', 'line1')).toBe(false);
    });
  });
});
