import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkRowLayoutService } from './network-row-layout.service';
import { NetworkLine } from '@shared/models';

describe('NetworkRowLayoutService', () => {
  let service: NetworkRowLayoutService;
  const opts = { padding: 80, size: 840 };

  beforeEach(() => {
    service = new NetworkRowLayoutService();
  });

  function line(id: string, code: string, stopIds: string[]): NetworkLine {
    return { id, code, name: code, color: '#000', type: null, itineraries: [stopIds] };
  }

  it('returns no positions for empty input', () => {
    const result = service.layout([], opts);
    expect(result.positions.size).toBe(0);
  });

  it('spreads stops evenly along a single line from padding to padding+size', () => {
    const result = service.layout([line('l1', 'A', ['s1', 's2', 's3', 's4', 's5'])], opts);

    const positions = result.positions.get('l1')!;
    expect(positions.get('s1')).toBeCloseTo(80);
    expect(positions.get('s5')).toBeCloseTo(920);
    // Spacing should be even
    const xs = ['s1', 's2', 's3', 's4', 's5'].map(id => positions.get(id)!);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    for (const g of gaps) {
      expect(g).toBeCloseTo(gaps[0]!);
    }
  });

  it('aligns interchange stops on the same X across lines', () => {
    // Two lines sharing s2 as interchange
    const result = service.layout([
      line('l1', 'A', ['s1', 's2', 's3']),
      line('l2', 'B', ['s4', 's2', 's5']),
    ], opts);

    const xOnL1 = result.positions.get('l1')!.get('s2')!;
    const xOnL2 = result.positions.get('l2')!.get('s2')!;
    expect(xOnL1).toBeCloseTo(xOnL2);
  });

  it('keeps interchange anchors at least minGap apart on each line', () => {
    // Two interchanges very close on l1: s2 and s3 (only 1 stop apart)
    const result = service.layout([
      line('l1', 'A', ['s1', 's2', 's3', 's4']),
      line('l2', 'B', ['x1', 's2', 'x2']),       // s2 is interchange
      line('l3', 'C', ['y1', 's3', 'y2']),       // s3 is interchange
    ], opts);

    const positions = result.positions.get('l1')!;
    const x2 = positions.get('s2')!;
    const x3 = positions.get('s3')!;
    expect(x3 - x2).toBeGreaterThanOrEqual(result.minGap);
  });

  it('handles lines with a single stop', () => {
    const result = service.layout([line('l1', 'A', ['only'])], opts);
    const x = result.positions.get('l1')!.get('only')!;
    // Should sit somewhere inside the canvas
    expect(x).toBeGreaterThanOrEqual(opts.padding);
    expect(x).toBeLessThanOrEqual(opts.padding + opts.size);
  });

  it('preserves itinerary order along the line (monotonic X)', () => {
    const stopIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = service.layout([line('l1', 'A', stopIds)], opts);
    const positions = result.positions.get('l1')!;
    const xs = stopIds.map(id => positions.get(id)!);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]!);
    }
  });
});
