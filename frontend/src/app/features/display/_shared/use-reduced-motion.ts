import { DestroyRef, Signal, inject, signal } from '@angular/core';

/**
 * Reactive boolean signal that tracks the OS-level
 * {@code prefers-reduced-motion} media query. The signal flips in real
 * time when the user toggles the system setting mid-session (e.g. on a
 * shared accessibility kiosk), and the underlying {@code MediaQueryList}
 * listener is wired into the consumer's {@code DestroyRef} so callers do
 * not have to manage teardown.
 *
 * Returns a steady {@code false} when {@code window} is unavailable
 * (server-side render, jsdom fallback without {@code matchMedia}) so
 * displays default to the motion-friendly variant.
 *
 * Must be called from an Angular injection context.
 */
export function useReducedMotion(): Signal<boolean> {
  const destroyRef = inject(DestroyRef);
  const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const reducedMotion = signal(mql?.matches ?? false);

  if (mql) {
    const handler = (event: MediaQueryListEvent): void => reducedMotion.set(event.matches);
    mql.addEventListener('change', handler);
    destroyRef.onDestroy(() => mql.removeEventListener('change', handler));
  }

  return reducedMotion.asReadonly();
}
