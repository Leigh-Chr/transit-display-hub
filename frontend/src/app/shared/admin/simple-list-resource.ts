import { Signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

/** Reactive read-model exposed back to non-paginated admin lists. */
export interface SimpleListResource<T> {
  /** Loaded rows, defaults to {@code []} while loading or on error so
   *  the template can iterate without an extra null guard. */
  readonly items: Signal<readonly T[]>;
  /** True while the underlying request is in flight. */
  readonly loading: Signal<boolean>;
  /** Last error thrown by the fetcher; {@code null} otherwise. */
  readonly error: Signal<unknown>;
  /** Re-trigger the fetcher (e.g. after a create / delete). */
  reload(): void;
}

/**
 * Thin wrapper around {@link rxResource} for admin pages that don't
 * carry pagination / sort / search state — the read-only counterpart of
 * {@link createAdminListResource}. Drops the URL bookkeeping and the
 * paginator-empty-after-delete dance.
 *
 * Use this whenever a component used to inline the
 * {@code loading + loadError + items = signal([]) + ngOnInit/load()}
 * pattern: it collapses into a single field initialiser and a
 * {@code reload()} call after a mutation.
 *
 * Must be called from an injection context (a field initialiser or the
 * constructor) — {@link rxResource} registers an effect under the
 * caller's injector.
 */
export function createSimpleListResource<T>(
  fetcher: () => Observable<readonly T[]>,
): SimpleListResource<T> {
  const resource = rxResource<readonly T[], undefined>({
    stream: () => fetcher(),
  });

  return {
    items: computed(() => (resource.hasValue() ? resource.value() : [])),
    loading: computed(() => resource.isLoading()),
    error: computed(() => resource.error()),
    reload: () => {
      resource.reload();
    },
  };
}
