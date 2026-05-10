import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import type { PageEvent } from '@angular/material/paginator';
import type { Sort } from '@angular/material/sort';

/** Free-form query string segment driven by a host-specific filter (lineId,
 *  severity, …) that the table state pushes/pulls alongside its own keys. */
export type AdminTableExtras = Readonly<
  Record<string, string | number | boolean | undefined>
>;

export interface AdminTableInit {
  sortBy: string;
  size?: number;
  sortDir?: 'asc' | 'desc';
  /** Called on every URL write to merge host-specific filters into the
   *  query string. The supplier reads fresh values each time so the host
   *  can mutate its own fields without re-initialising the state. */
  extras?: () => AdminTableExtras;
}

/** Page / size / sortBy / sortDir / search state shared by admin list
 *  pages, kept in sync with the route's query params. Provided per
 *  component (`providers: [AdminTableState]`) so each page has its own
 *  cursor and the router-tied state is disposed with the component. */
@Injectable()
export class AdminTableState {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  page = 0;
  size = 10;
  sortBy = '';
  sortDir: 'asc' | 'desc' = 'asc';
  search = '';

  private defaultSize = 10;
  private defaultSortBy = '';
  private defaultSortDir: 'asc' | 'desc' = 'asc';
  private extrasSupplier: () => AdminTableExtras = () => ({});

  init(opts: AdminTableInit): void {
    this.defaultSize = opts.size ?? 10;
    this.defaultSortBy = opts.sortBy;
    this.defaultSortDir = opts.sortDir ?? 'asc';
    this.size = this.defaultSize;
    this.sortBy = this.defaultSortBy;
    this.sortDir = this.defaultSortDir;
    this.extrasSupplier = opts.extras ?? (() => ({}));
  }

  syncFromQueryParams(params: Params): void {
    this.page = params['page'] ? +params['page'] : 0;
    this.size = params['size'] ? +params['size'] : this.defaultSize;
    this.sortBy = (params['sortBy'] as string | undefined) ?? this.defaultSortBy;
    this.sortDir = params['sortDir'] === 'desc' ? 'desc' : 'asc';
    this.search = (params['search'] as string | undefined) ?? '';
  }

  updateUrl(): void {
    const queryParams: Record<string, string | number | boolean> = {};
    if (this.page > 0) {queryParams['page'] = this.page;}
    if (this.size !== this.defaultSize) {queryParams['size'] = this.size;}
    if (this.sortBy !== this.defaultSortBy) {queryParams['sortBy'] = this.sortBy;}
    if (this.sortDir !== this.defaultSortDir) {queryParams['sortDir'] = this.sortDir;}
    if (this.search) {queryParams['search'] = this.search;}
    const extras = this.extrasSupplier();
    for (const key of Object.keys(extras)) {
      const value = extras[key];
      if (value !== undefined && value !== '') {
        queryParams[key] = value;
      }
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex;
    this.size = event.pageSize;
    this.updateUrl();
  }

  onSortChange(event: Sort): void {
    this.sortBy = event.active;
    this.sortDir = event.direction === 'desc' ? 'desc' : 'asc';
    this.page = 0;
    this.updateUrl();
  }

  onSearchChange(search: string): void {
    this.search = search;
    this.page = 0;
    this.updateUrl();
  }

  resetToFirstPage(): void {
    this.page = 0;
    this.updateUrl();
  }
}
