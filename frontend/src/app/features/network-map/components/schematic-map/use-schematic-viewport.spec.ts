import { ElementRef, EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { useSchematicViewport } from './use-schematic-viewport';
import { NetworkLineRow } from './schematic-geometry';

const EMPTY_SVG_REF = signal<ElementRef<SVGSVGElement> | undefined>(undefined);

function rowsFixture(): NetworkLineRow[] {
  return [
    {
      line: {
        id: 'l1', code: 'L1', name: 'L1', color: '#000',
        type: 'METRO', itineraries: [], scheduleCount: 0,
      } as unknown as NetworkLineRow['line'],
      y: 100,
      stops: [
        { stop: { id: 's1' } as NetworkLineRow['stops'][number]['stop'], x: 50 },
        { stop: { id: 's2' } as NetworkLineRow['stops'][number]['stop'], x: 250 },
      ],
      path: 'M 50,100 L 250,100',
    },
  ];
}

describe('useSchematicViewport', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('returns the default viewBox when no rows are visible', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const rows = signal<NetworkLineRow[]>([]);
    const zoom = signal(1);

    const viewport = runInInjectionContext(injector, () =>
      useSchematicViewport({ rows, zoomLevel: zoom, svgElement: EMPTY_SVG_REF }),
    );

    expect(viewport.baseViewBox()).toEqual({ x: 0, y: 0, w: 1000, h: 600 });
  });

  it('frames the viewBox around the visible rows with margins', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const rows = signal(rowsFixture());
    const zoom = signal(1);

    const viewport = runInInjectionContext(injector, () =>
      useSchematicViewport({ rows, zoomLevel: zoom, svgElement: EMPTY_SVG_REF }),
    );

    const vb = viewport.baseViewBox();
    expect(vb.x).toBeLessThan(50);
    expect(vb.y).toBe(100 - 160);
    expect(vb.w).toBeGreaterThan(250 - 50);
    expect(vb.h).toBeGreaterThanOrEqual(200);
  });

  it('falls back to the default viewBox when rows have no laid-out stops', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const rows = signal<NetworkLineRow[]>([{
      line: { id: 'l1', code: 'L1', name: 'L1', color: '#000', type: 'METRO', itineraries: [], scheduleCount: 0 } as unknown as NetworkLineRow['line'],
      y: 100,
      stops: [],
      path: '',
    }]);
    const zoom = signal(1);

    const viewport = runInInjectionContext(injector, () =>
      useSchematicViewport({ rows, zoomLevel: zoom, svgElement: EMPTY_SVG_REF }),
    );

    expect(viewport.baseViewBox()).toEqual({ x: 0, y: 0, w: 1000, h: 600 });
  });

  it('returns invZoom = 1 while the SVG has not been measured yet', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const rows = signal(rowsFixture());
    const zoom = signal(1);

    const viewport = runInInjectionContext(injector, () =>
      useSchematicViewport({ rows, zoomLevel: zoom, svgElement: EMPTY_SVG_REF }),
    );

    expect(viewport.baseScale()).toBe(1);
    expect(viewport.invZoom()).toBe(1);
  });

  it('exposes label transforms that round-trip the inverse scale into the SVG transform string', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const rows = signal(rowsFixture());
    const zoom = signal(2);

    const viewport = runInInjectionContext(injector, () =>
      useSchematicViewport({ rows, zoomLevel: zoom, svgElement: EMPTY_SVG_REF }),
    );

    const invZoom = viewport.invZoom();
    expect(viewport.labelTransformUp()).toBe(`rotate(-45) scale(${invZoom}) translate(8, -8)`);
    expect(viewport.labelTransformDown()).toBe(`rotate(45) scale(${invZoom}) translate(8, 8)`);
  });
});
