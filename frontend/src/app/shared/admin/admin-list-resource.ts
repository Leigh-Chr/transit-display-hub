import { Signal, computed, effect, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type Params } from '@angular/router';
import { Observable } from 'rxjs';
import { PageResponse } from '@shared/models';
import { AdminTableState, type AdminTableExtras } from './admin-table-state.service';

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
 * Page-specific extra filter dimension (lineId, severity, active…)
 * layered on top of the standard page / size / sort / search set.
 */
export interface AdminListExtras {
  /** Current extra-filter values, read fresh on every URL write so the
   *  page can mutate its own signals without re-initialising. Passed
   *  straight through to {@link AdminTableState.init}. */
  supply: () => AdminTableExtras;
  /** Mirrors the URL's extra params back into the page-local signals
   *  the filter controls bind to. */
  syncFromUrl: (params: Params) => void;
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
 * before reaching the fetch callback. The callback also receives the
 * raw params bag so a page can pull its own extra filters out of it.
 *
 * Must be called from an injection context (a field initialiser or the
 * constructor) — it injects {@link ActivatedRoute} and registers two
 * effects. {@link AdminTableState} is provided at the component level,
 * so pass the component's own instance in.
 */
export function createAdminListResource<T>(config: {
  tableState: AdminTableState;
  defaults: { sortBy: string; sortDir?: 'asc' | 'desc'; size?: number };
  fetch: (request: AdminListRequest, rawParams: Params) => Observable<PageResponse<T>>;
  extras?: AdminListExtras;
}): AdminListResource<T> {
  const route = inject(ActivatedRoute);
  const { tableState, defaults, fetch, extras } = config;
  // Matches AdminTableState's own default so a page that omits `size`
  // keeps the 10-row default the shared state already applies.
  const defaultSize = defaults.size ?? 10;

  // init() runs before the first queryParams emission so the defaults
  // are in place when syncFromQueryParams() reconciles. Optional fields
  // are spread in only when set so the property stays absent rather
  // than explicitly undefined (exactOptionalPropertyTypes).
  tableState.init({
    sortBy: defaults.sortBy,
    ...(defaults.size !== undefined ? { size: defaults.size } : {}),
    ...(defaults.sortDir !== undefined ? { sortDir: defaults.sortDir } : {}),
    ...(extras !== undefined ? { extras: extras.supply } : {}),
  });
  const queryParams = toSignal(route.queryParams, { initialValue: {} });

  // URL → tableState (+ page-local extra filters) for the toolbar
  // bindings. Kept out of the resource params so the resource contract
  // stays pure — it derives its request from the queryParams snapshot
  // directly.
  effect(() => {
    const params = queryParams();
    tableState.syncFromQueryParams(params);
    extras?.syncFromUrl(params);
  });

  const resource = rxResource<PageResponse<T>, Record<string, string | undefined>>({
    params: () => queryParams(),
    stream: ({ params: p }) => {
      const rawSort = p['sortBy'] ?? defaults.sortBy;
      const [field, splitDir] = rawSort.includes(':')
        ? (rawSort.split(':') as [string, string])
        : [rawSort, undefined];
      const sortDir: 'asc' | 'desc' =
        (splitDir ?? p['sortDir'] ?? defaults.sortDir) === 'desc' ? 'desc' : 'asc';
      return fetch(
        {
          page: +(p['page'] ?? 0),
          size: +(p['size'] ?? defaultSize),
          sortBy: field,
          sortDir,
          search: p['search'] ?? undefined,
        },
        p,
      );
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
