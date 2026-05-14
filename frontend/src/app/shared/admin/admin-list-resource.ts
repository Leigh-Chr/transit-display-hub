import { Signal, computed, effect, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { PageResponse } from '@shared/models';
import { AdminTableState } from './admin-table-state.service';

/** Normalised request shape handed to the page's fetch callback. */
export interface AdminListRequest {
  page: number;
  size: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  search: string | undefined;
}

/** Reactive read-model exposed back to the component / template. */
export interface AdminListResource<T> {
  readonly items: Signal<T[]>;
  readonly loading: Signal<boolean>;
  readonly loadError: Signal<unknown>;
  readonly totalElements: Signal<number>;
  reload(): void;
}

/**
 * Wires the boilerplate every paginated admin CRUD page repeats:
 *
 *  - bind the URL query params to a signal,
 *  - drive an {@link rxResource} off them,
 *  - mirror them into the shared {@link AdminTableState} so the
 *    toolbar bindings (search box, sort select, paginator) stay live,
 *  - step the page cursor back when a delete empties the last page.
 *
 * The {@code sortBy} param accepts the {@code "field:desc"} shorthand
 * the sort selects emit; it is split into {@code sortBy} / {@code sortDir}
 * before reaching the fetch callback.
 *
 * Must be called from an injection context (a field initialiser or the
 * constructor) — it injects {@link ActivatedRoute} and registers two
 * effects. {@link AdminTableState} is provided at the component level,
 * so pass the component's own instance in.
 */
export function createAdminListResource<T>(config: {
  tableState: AdminTableState;
  defaults: { sortBy: string; size?: number };
  fetch: (request: AdminListRequest) => Observable<PageResponse<T>>;
}): AdminListResource<T> {
  const route = inject(ActivatedRoute);
  const { tableState, defaults, fetch } = config;
  const defaultSize = defaults.size ?? 12;

  // init() runs before the first queryParams emission so the default
  // sort / size are in place when syncFromQueryParams() reconciles.
  // size is passed only when set so the property stays absent rather
  // than explicitly undefined (exactOptionalPropertyTypes).
  tableState.init(
    defaults.size === undefined
      ? { sortBy: defaults.sortBy }
      : { sortBy: defaults.sortBy, size: defaults.size },
  );
  const queryParams = toSignal(route.queryParams, { initialValue: {} });

  // URL → tableState for the toolbar bindings. Kept out of the
  // resource params so the resource contract stays pure — it derives
  // its request from the queryParams snapshot directly.
  effect(() => {
    tableState.syncFromQueryParams(queryParams());
  });

  const resource = rxResource<PageResponse<T>, Record<string, string | undefined>>({
    params: () => queryParams(),
    stream: ({ params: p }) => {
      const rawSort = p['sortBy'] ?? defaults.sortBy;
      const [field, splitDir] = rawSort.includes(':')
        ? (rawSort.split(':') as [string, string])
        : [rawSort, undefined];
      const sortDir: 'asc' | 'desc' =
        (splitDir ?? p['sortDir']) === 'desc' ? 'desc' : 'asc';
      return fetch({
        page: +(p['page'] ?? 0),
        size: +(p['size'] ?? defaultSize),
        sortBy: field,
        sortDir,
        search: p['search'] ?? undefined,
      });
    },
  });

  // When a delete on the last item of a non-first page leaves the page
  // empty, the server still reports totalElements > 0 on an earlier
  // page. Step the cursor back through the URL — that re-fires the
  // resource via the normal queryParams pathway.
  effect(() => {
    const page = resource.hasValue() ? resource.value() : undefined;
    if (page?.content.length === 0 && tableState.page > 0 && page.totalElements > 0) {
      tableState.page = Math.max(0, page.totalPages - 1);
      tableState.updateUrl();
    }
  });

  return {
    items: computed(() => (resource.hasValue() ? resource.value().content : [])),
    loading: computed(() => resource.isLoading()),
    loadError: computed(() => resource.error()),
    totalElements: computed(() => (resource.hasValue() ? resource.value().totalElements : 0)),
    reload: () => resource.reload(),
  };
}
