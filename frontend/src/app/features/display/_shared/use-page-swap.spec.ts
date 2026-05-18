import { EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { usePageSwap } from './use-page-swap';

describe('usePageSwap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at page 0 and stays put while disabled', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const enabled = signal(false);
    const totalPages = signal(3);

    const swap = runInInjectionContext(injector, () => usePageSwap(enabled, totalPages, 1000));
    TestBed.tick();

    expect(swap.pageIndex()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(swap.pageIndex()).toBe(0);
  });

  it('cycles through pages while enabled and wraps at the end', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const enabled = signal(true);
    const totalPages = signal(3);

    const swap = runInInjectionContext(injector, () => usePageSwap(enabled, totalPages, 1000));
    TestBed.tick();

    expect(swap.pageIndex()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(swap.pageIndex()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(swap.pageIndex()).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(swap.pageIndex()).toBe(0);
  });

  it('resets to 0 and stops cycling when enabled flips back to false', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const enabled = signal(true);
    const totalPages = signal(3);

    const swap = runInInjectionContext(injector, () => usePageSwap(enabled, totalPages, 1000));
    TestBed.tick();

    vi.advanceTimersByTime(2000);
    expect(swap.pageIndex()).toBe(2);

    enabled.set(false);
    TestBed.tick();
    expect(swap.pageIndex()).toBe(0);

    vi.advanceTimersByTime(5000);
    expect(swap.pageIndex()).toBe(0);
  });

  it('snaps the index back to 0 when totalPages shrinks below it', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const enabled = signal(true);
    const totalPages = signal(4);

    const swap = runInInjectionContext(injector, () => usePageSwap(enabled, totalPages, 1000));
    TestBed.tick();

    vi.advanceTimersByTime(3000);
    expect(swap.pageIndex()).toBe(3);

    totalPages.set(2);
    TestBed.tick();
    expect(swap.pageIndex()).toBe(0);
  });

  it('stays on page 0 when there is only one page worth of content', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const enabled = signal(true);
    const totalPages = signal(1);

    const swap = runInInjectionContext(injector, () => usePageSwap(enabled, totalPages, 1000));
    TestBed.tick();

    vi.advanceTimersByTime(5000);
    expect(swap.pageIndex()).toBe(0);
  });

  it('exposes a manual reset hook', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const enabled = signal(true);
    const totalPages = signal(3);

    const swap = runInInjectionContext(injector, () => usePageSwap(enabled, totalPages, 1000));
    TestBed.tick();

    vi.advanceTimersByTime(2000);
    expect(swap.pageIndex()).toBe(2);

    swap.resetToFirstPage();
    expect(swap.pageIndex()).toBe(0);
  });
});
