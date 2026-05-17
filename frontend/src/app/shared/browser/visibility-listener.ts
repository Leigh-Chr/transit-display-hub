import { DestroyRef, Signal, inject, signal } from '@angular/core';

/** Read-only view of {@code document.visibilityState} exposed as a
 *  signal, plus a {@code visible$/hidden$} hook for one-shot side-effects
 *  callers want to fire only on the transition (e.g. restart a clock). */
export interface VisibilityListener {
  /** {@code true} while the document is visible (foreground tab). */
  readonly isVisible: Signal<boolean>;
  /** Register a callback that runs every time the tab transitions to
   *  visible. Useful for "kick off a refresh on resume" semantics. */
  onVisible(callback: () => void): void;
  /** Register a callback that runs every time the tab transitions to
   *  hidden. Useful for pausing timers / closing streams. */
  onHidden(callback: () => void): void;
}

/**
 * Tracks {@code document.visibilityState} as a signal and auto-cleans
 * the underlying event listener on destroy. Falls back to "always
 * visible" outside a browser context (SSR, unit tests with no DOM).
 *
 * Must be called from an injection context — it grabs
 * {@link DestroyRef} so consumers don't have to remember to tear the
 * listener down themselves.
 */
export function injectVisibilityListener(): VisibilityListener {
  const destroyRef = inject(DestroyRef);
  const hasDocument = typeof document !== 'undefined';
  const isVisible = signal(hasDocument ? !document.hidden : true);
  const onVisibleCallbacks: (() => void)[] = [];
  const onHiddenCallbacks: (() => void)[] = [];

  if (hasDocument) {
    const handler = (): void => {
      const visible = !document.hidden;
      isVisible.set(visible);
      const queue = visible ? onVisibleCallbacks : onHiddenCallbacks;
      for (const cb of queue) {
        cb();
      }
    };
    document.addEventListener('visibilitychange', handler);
    destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', handler));
  }

  return {
    isVisible: isVisible.asReadonly(),
    onVisible: (cb) => {
      onVisibleCallbacks.push(cb);
    },
    onHidden: (cb) => {
      onHiddenCallbacks.push(cb);
    },
  };
}
