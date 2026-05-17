import { describe, expect, it } from 'vitest';

import { computeArrivalsView } from './use-arrivals-view';

describe('computeArrivalsView', () => {
  const now = new Date('2026-05-17T22:00:00');
  const baseConfig = {
    maxVisibleArrivals: 8,
    criticalMessagesCount: 0,
    hasInfoMessages: false,
  };

  it('keeps arrivals scheduled after now', () => {
    const view = computeArrivalsView(
      [
        { scheduledTime: '22:05' },
        { scheduledTime: '22:30' },
        { scheduledTime: '21:30' }, // already past
      ],
      now,
      baseConfig,
    );

    expect(view.allArrivals.map((a) => a.scheduledTime)).toEqual(['22:05', '22:30']);
  });

  it('keeps an arrival that wraps across midnight (late night service)', () => {
    const lateNight = new Date('2026-05-17T23:50:00');
    const view = computeArrivalsView(
      [
        { scheduledTime: '00:05' }, // tomorrow, 15 min away
        { scheduledTime: '23:55' }, // 5 min away tonight
      ],
      lateNight,
      baseConfig,
    );

    // Both kept (midnight-wrap tolerance), order is the input order — the
    // filter doesn't sort; that's the caller's job when needed.
    expect(view.allArrivals.length).toBe(2);
  });

  it('flags needsScrolling when the row count exceeds the visible threshold', () => {
    const arrivals = Array.from({ length: 12 }, (_, i) => ({
      scheduledTime: `22:${String(i).padStart(2, '0')}`,
    }));

    const view = computeArrivalsView(arrivals, now, baseConfig);

    expect(view.needsScrolling).toBe(true);
  });

  it('does not scroll for short lists', () => {
    const view = computeArrivalsView(
      [{ scheduledTime: '22:05' }],
      now,
      baseConfig,
    );

    expect(view.needsScrolling).toBe(false);
  });

  it('returns a CSS-friendly seconds string with a 10s floor', () => {
    const oneRow = computeArrivalsView([{ scheduledTime: '22:05' }], now, baseConfig);
    expect(oneRow.scrollDuration).toBe('10s');

    const tenRows = computeArrivalsView(
      Array.from({ length: 10 }, (_, i) => ({ scheduledTime: `22:${String(i).padStart(2, '0')}` })),
      now,
      baseConfig,
    );
    expect(tenRows.scrollDuration).toBe('40s');
  });

  it('lowers the threshold by one per critical message', () => {
    const arrivals = Array.from({ length: 6 }, (_, i) => ({
      scheduledTime: `22:${String(i).padStart(2, '0')}`,
    }));

    const noCritical = computeArrivalsView(arrivals, now, baseConfig);
    expect(noCritical.needsScrolling).toBe(false);

    const twoCritical = computeArrivalsView(arrivals, now, {
      ...baseConfig,
      criticalMessagesCount: 2,
      maxVisibleArrivals: 6,
      minVisibleArrivals: 3,
    });
    expect(twoCritical.needsScrolling).toBe(true);
  });

  it('gives a +1 row bonus when no info ticker is rendered', () => {
    const arrivals = Array.from({ length: 6 }, (_, i) => ({
      scheduledTime: `22:${String(i).padStart(2, '0')}`,
    }));

    const tickerOff = computeArrivalsView(arrivals, now, {
      maxVisibleArrivals: 5,
      criticalMessagesCount: 0,
      hasInfoMessages: false,
      minVisibleArrivals: 3,
      maxVisibleAfterPenalty: 6,
    });
    expect(tickerOff.needsScrolling).toBe(false);

    const tickerOn = computeArrivalsView(arrivals, now, {
      maxVisibleArrivals: 5,
      criticalMessagesCount: 0,
      hasInfoMessages: true,
      minVisibleArrivals: 3,
      maxVisibleAfterPenalty: 6,
    });
    expect(tickerOn.needsScrolling).toBe(true);
  });
});
