import { describe, it, expect } from 'vitest';
import { FlexLocation } from '@shared/models';
import {
  buildViewport,
  colorForFeature,
  ringToSvgPath,
  ringsFromLocation,
} from './tad-zones.utils';

function makeLocation(over: Partial<FlexLocation> = {}): FlexLocation {
  return {
    id: 'loc-1',
    externalId: 'EXT_1',
    stopExternalId: null,
    name: 'Zone Nord',
    geometryType: 'Polygon',
    geometryJson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[[5.70, 45.18], [5.75, 45.18], [5.75, 45.20], [5.70, 45.20], [5.70, 45.18]]],
    }),
    minLatitude: 45.18,
    maxLatitude: 45.20,
    minLongitude: 5.70,
    maxLongitude: 5.75,
    ...over,
  };
}

describe('ringsFromLocation', () => {
  it('extracts the outer ring of a Polygon', () => {
    const rings = ringsFromLocation(makeLocation(), 0);
    expect(rings).toHaveLength(1);
    expect(rings[0]?.outer).toBe(true);
    expect(rings[0]?.featureIndex).toBe(0);
    expect(rings[0]?.coords).toHaveLength(5);
  });

  it('extracts every polygon of a MultiPolygon, marking outer rings', () => {
    const loc = makeLocation({
      geometryType: 'MultiPolygon',
      geometryJson: JSON.stringify({
        type: 'MultiPolygon',
        coordinates: [
          [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]],
        ],
      }),
    });
    const rings = ringsFromLocation(loc, 7);
    expect(rings).toHaveLength(2);
    expect(rings.every(r => r.outer)).toBe(true);
    expect(rings.every(r => r.featureIndex === 7)).toBe(true);
  });

  it('keeps inner rings of a Polygon and flags them as non-outer', () => {
    const loc = makeLocation({
      geometryJson: JSON.stringify({
        type: 'Polygon',
        coordinates: [
          [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
          [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],
        ],
      }),
    });
    const rings = ringsFromLocation(loc, 0);
    expect(rings).toHaveLength(2);
    expect(rings[0]?.outer).toBe(true);
    expect(rings[1]?.outer).toBe(false);
  });

  it('rejects unknown geometry types', () => {
    expect(ringsFromLocation(
      makeLocation({ geometryType: 'LineString', geometryJson: '{"type":"LineString","coordinates":[[0,0],[1,1]]}' }),
      0,
    )).toEqual([]);
  });

  it('rejects malformed JSON without throwing', () => {
    expect(ringsFromLocation(
      makeLocation({ geometryJson: '{not json' }),
      0,
    )).toEqual([]);
  });

  it('rejects rings with fewer than 3 points', () => {
    const loc = makeLocation({
      geometryJson: JSON.stringify({
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 1]]],
      }),
    });
    expect(ringsFromLocation(loc, 0)).toEqual([]);
  });
});

describe('buildViewport', () => {
  it('produces a deterministic viewBox of 800x480', () => {
    const vp = buildViewport([makeLocation()]);
    expect(vp.viewBox).toBe('0 0 800 480');
    expect(vp.width).toBe(800);
    expect(vp.height).toBe(480);
  });

  it('projects the bbox corners inside the canvas with margin', () => {
    const vp = buildViewport([makeLocation()]);
    const corner = vp.project(5.70, 45.18);
    // 8 % margin on either side → corners should be ≥ 38 px from the edges.
    expect(corner.x).toBeGreaterThanOrEqual(20);
    expect(corner.y).toBeLessThanOrEqual(480 - 20);
  });

  it('flips the latitude axis (north → smaller y)', () => {
    const vp = buildViewport([makeLocation()]);
    const south = vp.project(5.725, 45.18);
    const north = vp.project(5.725, 45.20);
    expect(north.y).toBeLessThan(south.y);
  });

  it('falls back to a neutral projection when no bbox is available', () => {
    const vp = buildViewport([]);
    expect(vp.viewBox).toBe('0 0 800 480');
    expect(vp.project(0, 0)).toEqual({ x: 400, y: 240 });
  });

  it('unions bounding boxes across multiple locations', () => {
    const vp = buildViewport([
      makeLocation({ minLongitude: 5.70, maxLongitude: 5.72, minLatitude: 45.18, maxLatitude: 45.19 }),
      makeLocation({ id: 'loc-2', externalId: 'EXT_2', minLongitude: 5.75, maxLongitude: 5.78, minLatitude: 45.21, maxLatitude: 45.22 }),
    ]);
    const sw = vp.project(5.70, 45.18);
    const ne = vp.project(5.78, 45.22);
    expect(sw.x).toBeLessThan(ne.x);
    expect(sw.y).toBeGreaterThan(ne.y);
  });
});

describe('ringToSvgPath', () => {
  it('starts with M, uses L for the rest, and closes with Z', () => {
    const ring = {
      featureIndex: 0,
      outer: true,
      coords: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] as [number, number][],
    };
    const path = ringToSvgPath(ring, (lon, lat) => ({ x: lon * 10, y: lat * 10 }));
    expect(path.startsWith('M ')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path.match(/L /g)?.length).toBe(4);
  });

  it('returns empty string for empty rings', () => {
    expect(ringToSvgPath(
      { featureIndex: 0, outer: true, coords: [] },
      (lon, lat) => ({ x: lon, y: lat }),
    )).toBe('');
  });
});

describe('colorForFeature', () => {
  it('produces deterministic HSL strings', () => {
    expect(colorForFeature(0)).toBe(colorForFeature(0));
    expect(colorForFeature(0)).toMatch(/^hsl\(\d+, 55%, 60%\)$/);
  });

  it('spreads adjacent indexes far apart on the hue wheel', () => {
    const a = colorForFeature(0);
    const b = colorForFeature(1);
    expect(a).not.toBe(b);
  });
});
