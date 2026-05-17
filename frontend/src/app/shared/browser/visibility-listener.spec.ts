import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectVisibilityListener } from './visibility-listener';

describe('injectVisibilityListener', () => {
  let injector: Injector;
  let hiddenValue: boolean;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);
    hiddenValue = false;
    // jsdom exposes document.hidden as a non-writable getter — override
    // with a controllable getter so the test can flip visibility freely.
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hiddenValue,
    });
  });

  afterEach(() => {
    // Best-effort restore — drop the override so subsequent tests
    // see the default jsdom behaviour.
    delete (document as { hidden?: boolean }).hidden;
  });

  function fireVisibilityChange(): void {
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('seeds isVisible from the current document.hidden value', () => {
    hiddenValue = true;
    const listener = runInInjectionContext(injector, () => injectVisibilityListener());
    expect(listener.isVisible()).toBe(false);
  });

  it('updates isVisible when the tab transitions to hidden then back', () => {
    const listener = runInInjectionContext(injector, () => injectVisibilityListener());
    expect(listener.isVisible()).toBe(true);

    hiddenValue = true;
    fireVisibilityChange();
    expect(listener.isVisible()).toBe(false);

    hiddenValue = false;
    fireVisibilityChange();
    expect(listener.isVisible()).toBe(true);
  });

  it('fires onVisible / onHidden callbacks on the matching transition', () => {
    const listener = runInInjectionContext(injector, () => injectVisibilityListener());
    const onVisible = vi.fn();
    const onHidden = vi.fn();
    listener.onVisible(onVisible);
    listener.onHidden(onHidden);

    hiddenValue = true;
    fireVisibilityChange();
    expect(onHidden).toHaveBeenCalledTimes(1);
    expect(onVisible).not.toHaveBeenCalled();

    hiddenValue = false;
    fireVisibilityChange();
    expect(onVisible).toHaveBeenCalledTimes(1);
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('removes its listener when the injector is destroyed', () => {
    const child = Injector.create({
      providers: [],
      parent: injector,
    }) as Injector & { destroy(): void };
    const listener = runInInjectionContext(child, () => injectVisibilityListener());
    const onHidden = vi.fn();
    listener.onHidden(onHidden);

    child.destroy();

    hiddenValue = true;
    fireVisibilityChange();
    expect(onHidden).not.toHaveBeenCalled();
  });
});
