import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminTableState } from './admin-table-state.service';

describe('AdminTableState', () => {
  let state: AdminTableState;
  let routerNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    routerNavigate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        AdminTableState,
        { provide: Router, useValue: { navigate: routerNavigate } },
        { provide: ActivatedRoute, useValue: {} },
      ],
    });

    state = TestBed.inject(AdminTableState);
    state.init({ sortBy: 'name' });
  });

  describe('init', () => {
    it('applies defaults for size and sortDir', () => {
      expect(state.size).toBe(10);
      expect(state.sortBy).toBe('name');
      expect(state.sortDir).toBe('asc');
    });

    it('respects overridden defaults', () => {
      state.init({ sortBy: 'code', size: 25, sortDir: 'desc' });

      expect(state.size).toBe(25);
      expect(state.sortBy).toBe('code');
      expect(state.sortDir).toBe('desc');
    });
  });

  describe('syncFromQueryParams', () => {
    it('reads all four pagination keys', () => {
      state.syncFromQueryParams({
        page: '3',
        size: '50',
        sortBy: 'createdAt',
        sortDir: 'desc',
        search: 'lyon',
      });

      expect(state.page).toBe(3);
      expect(state.size).toBe(50);
      expect(state.sortBy).toBe('createdAt');
      expect(state.sortDir).toBe('desc');
      expect(state.search).toBe('lyon');
    });

    it('falls back to defaults on missing keys', () => {
      state.syncFromQueryParams({});

      expect(state.page).toBe(0);
      expect(state.size).toBe(10);
      expect(state.sortBy).toBe('name');
      expect(state.sortDir).toBe('asc');
      expect(state.search).toBe('');
    });

    it('coerces sortDir other than "desc" to "asc"', () => {
      state.syncFromQueryParams({ sortDir: 'wat' });

      expect(state.sortDir).toBe('asc');
    });
  });

  describe('updateUrl', () => {
    it('omits keys equal to their defaults', () => {
      state.updateUrl();

      expect(routerNavigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: {}, replaceUrl: true }),
      );
    });

    it('writes only changed keys', () => {
      state.page = 2;
      state.search = 'foo';
      state.updateUrl();

      const call = routerNavigate.mock.calls[0]?.[1] as { queryParams: Record<string, unknown> };
      expect(call.queryParams).toEqual({ page: 2, search: 'foo' });
    });

    it('merges extras from the supplier and skips empty values', () => {
      state.init({
        sortBy: 'name',
        extras: () => ({ lineId: 'L1', severity: '', active: true }),
      });
      state.updateUrl();

      const call = routerNavigate.mock.calls[0]?.[1] as { queryParams: Record<string, unknown> };
      expect(call.queryParams).toEqual({ lineId: 'L1', active: true });
    });
  });

  describe('handlers', () => {
    it('onPageChange writes page and size, keeps sort', () => {
      state.onPageChange({ pageIndex: 4, pageSize: 25, length: 0 });

      expect(state.page).toBe(4);
      expect(state.size).toBe(25);
      expect(routerNavigate).toHaveBeenCalledOnce();
    });

    it('onSortChange resets to page 0 and stores sort', () => {
      state.page = 3;
      state.onSortChange({ active: 'createdAt', direction: 'desc' });

      expect(state.page).toBe(0);
      expect(state.sortBy).toBe('createdAt');
      expect(state.sortDir).toBe('desc');
    });

    it('onSortChange treats empty direction as asc', () => {
      state.onSortChange({ active: 'name', direction: '' });

      expect(state.sortDir).toBe('asc');
    });

    it('onSearchChange resets to page 0 and stores search', () => {
      state.page = 5;
      state.onSearchChange('grenoble');

      expect(state.page).toBe(0);
      expect(state.search).toBe('grenoble');
    });

    it('resetToFirstPage clears the page index and writes', () => {
      state.page = 7;
      state.resetToFirstPage();

      expect(state.page).toBe(0);
      expect(routerNavigate).toHaveBeenCalledOnce();
    });
  });
});
