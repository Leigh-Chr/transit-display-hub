import { DestroyRef, Signal, effect, inject, signal } from '@angular/core';

export interface PageSwap {
  /** 0-based index of the page currently shown. */
  readonly pageIndex: Signal<number>;
  /** Force the pointer back to the first page. Useful when the source
   *  list changes shape outside this composable's awareness. */
  resetToFirstPage(): void;
}

/**
 * Drives a paginated view used by displays running in
 * {@code prefers-reduced-motion} mode. While {@code enabled} is
 * {@code true}, {@link PageSwap.pageIndex} advances every
 * {@code dwellMs} milliseconds and wraps modulo {@code totalPages()};
 * when {@code enabled} flips back to {@code false} the timer stops and
 * the index resets to {@code 0} so the consumer falls back to the
 * continuous-scroll variant.
 *
 * If {@code totalPages()} shrinks below the current index (e.g. the
 * WebSocket pushed fewer arrivals), the index re-anchors to {@code 0}
 * on the next change-detection tick so the template never lands on an
 * empty slice.
 *
 * Must be called from an Angular injection context — it grabs
 * {@code DestroyRef} so the interval clears itself on teardown.
 */
export function usePageSwap(
  enabled: Signal<boolean>,
  totalPages: Signal<number>,
  dwellMs: number,
): PageSwap {
  const destroyRef = inject(DestroyRef);
  const pageIndex = signal(0);

  let intervalId: ReturnType<typeof setInterval> | null = null;
  const start = (): void => {
    if (intervalId !== null) { return; }
    intervalId = setInterval(() => {
      const total = totalPages();
      if (total <= 1) {
        pageIndex.set(0);
        return;
      }
      pageIndex.set((pageIndex() + 1) % total);
    }, dwellMs);
  };
  const stop = (): void => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  effect(() => {
    if (enabled()) {
      start();
    } else {
      stop();
      pageIndex.set(0);
    }
  });

  effect(() => {
    const total = totalPages();
    if (total === 0 || pageIndex() >= total) {
      pageIndex.set(0);
    }
  });

  destroyRef.onDestroy(() => stop());

  return {
    pageIndex: pageIndex.asReadonly(),
    resetToFirstPage(): void { pageIndex.set(0); },
  };
}
