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

  describe('multi-itinerary lines', () => {
    // Line Y has a Y-shape topology: Trunk -> Junction, then either
    // Branch A (primary itinerary) or Branch B (secondary). The route-finder
    // must consider both itineraries to reach Branch B.
    const yShape: NetworkMap = {
      lines: [
        {
          id: 'lineY',
          code: 'Y',
          name: 'Branch line',
          color: '#0F0',
          type: null,
          itineraries: [
            ['trunk', 'junction', 'branchA'],
            ['trunk', 'junction', 'branchB'],
          ],
        },
      ],
      stops: [
        { id: 'trunk',    name: 'Trunk',    latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['Y'] },
        { id: 'junction', name: 'Junction', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['Y'] },
        { id: 'branchA',  name: 'Branch A', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['Y'] },
        { id: 'branchB',  name: 'Branch B', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['Y'] },
      ],
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    };

    it('reaches a stop that lives only on a non-primary itinerary', () => {
      const result = service.findRoute(yShape, 'trunk', 'branchB');
      expect(result).not.toBeNull();
      expect(result!.segments).toHaveLength(1);
      expect(result!.segments[0]!.stopIds).toEqual(['trunk', 'junction', 'branchB']);
      expect(result!.transfers).toBe(0);
    });

    it('labels the direction with the matching branch terminus', () => {
      const toA = service.findRoute(yShape, 'trunk', 'branchA');
      const toB = service.findRoute(yShape, 'trunk', 'branchB');
      expect(toA!.segments[0]!.directionName).toBe('Branch A');
      expect(toB!.segments[0]!.directionName).toBe('Branch B');
    });

    it('routes between the two branch tips through the junction', () => {
      const result = service.findRoute(yShape, 'branchA', 'branchB');
      expect(result).not.toBeNull();
      // Single segment on line Y is enough — no transfer needed.
      expect(result!.segments).toHaveLength(1);
      expect(result!.segments[0]!.stopIds[0]).toBe('branchA');
      expect(result!.segments[0]!.stopIds[result!.segments[0]!.stopIds.length - 1]).toBe('branchB');
    });

    it('labels the direction correctly when travelling the reverse itinerary', () => {
      const oneWay: NetworkMap = {
        lines: [
          {
            id: 'lineL',
            code: 'L',
            name: 'L',
            color: '#000',
            type: null,
            itineraries: [
              ['s1', 's2', 's3'],
              ['s3', 's2', 's1'],
            ],
          },
        ],
        stops: [
          { id: 's1', name: 'S1', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L'] },
          { id: 's2', name: 'S2', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L'] },
          { id: 's3', name: 'S3', latitude: null, longitude: null, schematicX: null, schematicY: null, lineCodes: ['L'] },
        ],
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      };
      const reverse = service.findRoute(oneWay, 's3', 's1');
      expect(reverse).not.toBeNull();
      expect(reverse!.segments[0]!.directionName).toBe('S1');
    });
  });
});
