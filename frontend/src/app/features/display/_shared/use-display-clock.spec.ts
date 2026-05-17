import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useDisplayClock } from './use-display-clock';
import { testTranslocoModule } from '../../../../test-translations';

describe('useDisplayClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T10:00:00'));
    TestBed.configureTestingModule({
      imports: [testTranslocoModule({})],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks every second while the document is visible', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const clock = runInInjectionContext(injector, () => useDisplayClock());
    const initial = clock.now();

    vi.advanceTimersByTime(1500);
    expect(clock.now().getTime()).toBeGreaterThan(initial.getTime());
  });

  it('reports isStale when lastUpdate is older than 3 minutes', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const clock = runInInjectionContext(injector, () => useDisplayClock());
    const lastUpdate = new Date('2026-05-17T09:55:00').getTime();

    expect(clock.isStale(lastUpdate)).toBe(true);
    expect(clock.staleMinutes(lastUpdate)).toBe(5);
  });

  it('reports not stale when lastUpdate is recent', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const clock = runInInjectionContext(injector, () => useDisplayClock());
    const lastUpdate = new Date('2026-05-17T09:59:30').getTime();

    expect(clock.isStale(lastUpdate)).toBe(false);
  });

  it('treats a null lastUpdate as fresh (no banner before the first push)', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const clock = runInInjectionContext(injector, () => useDisplayClock());

    expect(clock.isStale(null)).toBe(false);
    expect(clock.staleMinutes(null)).toBe(0);
  });

  it('exposes locale-formatted clock and date', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const clock = runInInjectionContext(injector, () => useDisplayClock());

    expect(clock.currentTime()).toMatch(/\d{1,2}:\d{2}/);
    expect(clock.currentDate().length).toBeGreaterThan(0);
  });
});
