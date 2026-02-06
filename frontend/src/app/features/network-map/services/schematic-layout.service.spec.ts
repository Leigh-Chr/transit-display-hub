import { describe, it, expect, beforeEach } from 'vitest';
import { SchematicLayoutService } from './schematic-layout.service';
import { NetworkStop, NetworkLine, NetworkBounds } from '@shared/models';

describe('SchematicLayoutService', () => {
  let service: SchematicLayoutService;

  const defaultBounds: NetworkBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  beforeEach(() => {
    service = new SchematicLayoutService();
  });

  it('should return empty stops for empty input', () => {
    const result = service.calculateLayout([], defaultBounds);

    expect(result.stops).toEqual([]);
    expect(result.bounds.width).toBe(1000);
    expect(result.bounds.height).toBe(1000);
  });

  it('should place stops using coordinate-based layout when coordinates exist', () => {
    const stops: NetworkStop[] = [
      { id: 's1', name: 'Stop 1', latitude: null, longitude: null, schematicX: 10, schematicY: 20, lineCodes: ['L1'] },
      { id: 's2', name: 'Stop 2', latitude: null, longitude: null, schematicX: 90, schematicY: 80, lineCodes: ['L1'] },
    ];

    const result = service.calculateLayout(stops, defaultBounds);

    expect(result.stops).toHaveLength(2);
    // s1 should be at bottom-left region (low schematicX, low schematicY -> high y because Y is inverted)
    const s1 = result.stops.find(s => s.id === 's1')!;
    const s2 = result.stops.find(s => s.id === 's2')!;
    expect(s1.x).toBeLessThan(s2.x);
    // Y is inverted: lower schematicY -> higher canvas Y
    expect(s1.y).toBeGreaterThan(s2.y);
  });

  it('should generate schematic layout from topology when no coordinates', () => {
    const stops: NetworkStop[] = [
      { id: 's1', name: 'Stop 1', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'] },
      { id: 's2', name: 'Stop 2', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'] },
      { id: 's3', name: 'Stop 3', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'] },
    ];
    const lines: NetworkLine[] = [
      { id: 'l1', code: 'L1', name: 'Line 1', color: '#F00', type: null, itineraries: [['s1', 's2', 's3']] },
    ];

    const result = service.calculateLayout(stops, defaultBounds, lines);

    expect(result.stops).toHaveLength(3);
    const xs = result.stops.map(s => s.x);
    // Stops should be in left-to-right order
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('should use grid fallback when no coordinates and no lines', () => {
    const stops: NetworkStop[] = [
      { id: 's1', name: 'Stop 1', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: [] },
      { id: 's2', name: 'Stop 2', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: [] },
      { id: 's3', name: 'Stop 3', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: [] },
      { id: 's4', name: 'Stop 4', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: [] },
    ];

    const result = service.calculateLayout(stops, defaultBounds);

    expect(result.stops).toHaveLength(4);
    // All positions should be within canvas bounds
    for (const stop of result.stops) {
      expect(stop.x).toBeGreaterThanOrEqual(0);
      expect(stop.x).toBeLessThanOrEqual(1000);
      expect(stop.y).toBeGreaterThanOrEqual(0);
      expect(stop.y).toBeLessThanOrEqual(1000);
    }
  });

  it('should keep all positions within layout bounds', () => {
    const stops: NetworkStop[] = [
      { id: 's1', name: 'A', latitude: 48.85, longitude: 2.29, schematicX: null, schematicY: null, lineCodes: ['L1'] },
      { id: 's2', name: 'B', latitude: 48.87, longitude: 2.35, schematicX: null, schematicY: null, lineCodes: ['L1'] },
    ];

    const result = service.calculateLayout(stops, defaultBounds);

    for (const stop of result.stops) {
      expect(stop.x).toBeGreaterThanOrEqual(result.bounds.minX);
      expect(stop.x).toBeLessThanOrEqual(result.bounds.maxX);
      expect(stop.y).toBeGreaterThanOrEqual(result.bounds.minY);
      expect(stop.y).toBeLessThanOrEqual(result.bounds.maxY);
    }
  });
});
