import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { useReducedMotion } from './use-reduced-motion';

type ChangeHandler = (event: MediaQueryListEvent) => void;

interface MockMql {
  matches: boolean;
  addEventListener: (type: 'change', handler: ChangeHandler) => void;
  removeEventListener: (type: 'change', handler: ChangeHandler) => void;
  emit(matches: boolean): void;
  listeners: ChangeHandler[];
}

function buildMockMatchMedia(initialMatches: boolean): { mql: MockMql; matchMedia: (q: string) => MockMql } {
  const listeners: ChangeHandler[] = [];
  const mql: MockMql = {
    matches: initialMatches,
    addEventListener: (_type, handler) => { listeners.push(handler); },
    removeEventListener: (_type, handler) => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) { listeners.splice(idx, 1); }
    },
    listeners,
    emit(matches: boolean): void {
      mql.matches = matches;
      listeners.forEach(handler => handler({ matches } as MediaQueryListEvent));
    },
  };
  return { mql, matchMedia: () => mql };
}

describe('useReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  // defineProperty defaults to writable:false when omitted, which would
  // freeze window.matchMedia and crash other specs that later try to
  // wrap it via simple assignment (e.g. the test-setup polyfill on a
  // worker re-init). Always pass writable:true to keep window mutable.
  const stubMatchMedia = (value: unknown): void => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value,
    });
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    stubMatchMedia(originalMatchMedia);
  });

  it('reads the initial MediaQueryList.matches value', () => {
    const { matchMedia } = buildMockMatchMedia(true);
    stubMatchMedia(matchMedia);

    const injector = TestBed.inject(EnvironmentInjector);
    const signal = runInInjectionContext(injector, () => useReducedMotion());

    expect(signal()).toBe(true);
  });

  it('updates the signal when the OS preference toggles mid-session', () => {
    const { mql, matchMedia } = buildMockMatchMedia(false);
    stubMatchMedia(matchMedia);

    const injector = TestBed.inject(EnvironmentInjector);
    const signal = runInInjectionContext(injector, () => useReducedMotion());

    expect(signal()).toBe(false);
    mql.emit(true);
    expect(signal()).toBe(true);
    mql.emit(false);
    expect(signal()).toBe(false);
  });

  it('registers exactly one change listener so a re-init does not leak', () => {
    const { mql, matchMedia } = buildMockMatchMedia(false);
    stubMatchMedia(matchMedia);

    const injector = TestBed.inject(EnvironmentInjector);
    runInInjectionContext(injector, () => useReducedMotion());

    expect(mql.listeners.length).toBe(1);
  });

  it('defaults to false when window.matchMedia is unavailable', () => {
    // The jsdom global ships matchMedia in newer versions, so stub it
    // explicitly to the unsupported case (undefined).
    stubMatchMedia(undefined);

    const injector = TestBed.inject(EnvironmentInjector);
    const signal = runInInjectionContext(injector, () => useReducedMotion());

    expect(signal()).toBe(false);
  });
});
