import { DestroyRef, Signal, inject, signal } from '@angular/core';

/** localStorage key the hint flips once it has been shown. Persists
 *  across sessions so a returning user is not nagged twice. */
const WHEEL_HINT_KEY = 'transit-hub.wheel-hint-seen';

/** How long the toast stays on screen the one time it does fire. */
const HINT_DURATION_MS = 3_000;

export interface WheelHint {
  /** {@code true} while the toast is being displayed. */
  readonly visible: Signal<boolean>;
  /** Show the hint if the user has never seen it on this browser; noop
   *  on subsequent calls. Auto-hides after 3 s and persists the seen
   *  flag in localStorage (private-browsing tolerant). */
  show(): void;
}

/**
 * Shows a one-shot "Ctrl + scroll to zoom" toast the first time the
 * user attempts a plain wheel scroll on the schematic map. Encapsulates
 * the localStorage persistence, the auto-hide timer and the teardown so
 * the host component just calls {@code hint.show()} and binds
 * {@code hint.visible()} in its template.
 *
 * Must be called from an injection context — it grabs a {@link DestroyRef}
 * to clear the timer when the host is torn down.
 */
export function useWheelHint(): WheelHint {
  const visible = signal(false);
  const destroyRef = inject(DestroyRef);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  destroyRef.onDestroy(clear);

  return {
    visible: visible.asReadonly(),
    show(): void {
      try {
        if (localStorage.getItem(WHEEL_HINT_KEY)) { return; }
        localStorage.setItem(WHEEL_HINT_KEY, '1');
      } catch {
        // Private mode / disabled storage — show the hint once this session
        // and skip persistence rather than failing.
      }
      visible.set(true);
      clear();
      timer = setTimeout(() => {
        visible.set(false);
        timer = null;
      }, HINT_DURATION_MS);
    },
  };
}
