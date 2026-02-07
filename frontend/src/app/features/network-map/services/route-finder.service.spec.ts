import { describe, it, expect, beforeEach } from 'vitest';
import { RouteFinderService } from './route-finder.service';
import { NetworkMap } from '@shared/models';

describe('RouteFinderService', () => {
  let service: RouteFinderService;

  // Two lines sharing stop "X":
  //   Line A: A1 -> X -> A2
  //   Line B: B1 -> X -> B2
  const networkMap: NetworkMap = {
    lines: [
      {
        id: 'lineA',
        code: 'LA',
        name: 'Line A',
        color: '#FF0000',
        type: null,
        itineraries: [['A1', 'X', 'A2']],
      },
      {
        id: 'lineB',
        code: 'LB',
        name: 'Line B',
        color: '#0000FF',
        type: null,
        itineraries: [['B1', 'X', 'B2']],
      },
    ],
    stops: [
      { id: 'A1', name: 'Alpha', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['LA'] },
      { id: 'X',  name: 'Transfer', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['LA', 'LB'] },
      { id: 'A2', name: 'Bravo', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['LA'] },
      { id: 'B1', name: 'Charlie', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['LB'] },
      { id: 'B2', name: 'Delta', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['LB'] },
    ],
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
  };

  beforeEach(() => {
    service = new RouteFinderService();
  });

  it('should return null when from and to are the same stop', () => {
    expect(service.findRoute(networkMap, 'A1', 'A1')).toBeNull();
  });

  it('should find a direct route on the same line', () => {
    const result = service.findRoute(networkMap, 'A1', 'A2');

    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(1);
    expect(result!.segments[0]!.lineCode).toBe('LA');
    expect(result!.segments[0]!.stopIds).toEqual(['A1', 'X', 'A2']);
    expect(result!.transfers).toBe(0);
    expect(result!.transferStopIds).toEqual([]);
  });

  it('should find a route with one transfer', () => {
    const result = service.findRoute(networkMap, 'A1', 'B2');

    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0]!.lineCode).toBe('LA');
    expect(result!.segments[1]!.lineCode).toBe('LB');
    expect(result!.transfers).toBe(1);
    expect(result!.transferStopIds).toContain('X');
  });

  it('should return null for disconnected stops', () => {
    const disconnected: NetworkMap = {
      lines: [
        { id: 'l1', code: 'L1', name: 'Line 1', color: '#F00', type: null, itineraries: [['s1', 's2']] },
        { id: 'l2', code: 'L2', name: 'Line 2', color: '#00F', type: null, itineraries: [['s3', 's4']] },
      ],
      stops: [
        { id: 's1', name: 'S1', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'] },
        { id: 's2', name: 'S2', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L1'] },
        { id: 's3', name: 'S3', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'] },
        { id: 's4', name: 'S4', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L2'] },
      ],
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    };

    expect(service.findRoute(disconnected, 's1', 's4')).toBeNull();
  });

  it('should support bidirectional travel', () => {
    const forward = service.findRoute(networkMap, 'A1', 'A2');
    const backward = service.findRoute(networkMap, 'A2', 'A1');

    expect(forward).not.toBeNull();
    expect(backward).not.toBeNull();
    expect(forward!.allStopIds).toEqual(['A1', 'X', 'A2']);
    expect(backward!.allStopIds).toEqual(['A2', 'X', 'A1']);
  });

  it('should compute correct direction names', () => {
    const result = service.findRoute(networkMap, 'A1', 'X');

    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(1);
    // Direction should be toward terminus (Bravo = A2) since we're going forward
    expect(result!.segments[0]!.directionName).toBe('Bravo');
  });
});
