import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LineService } from '@core/api/line.service';
import { Line, PageResponse } from '@shared/models';
import { LinesComponent } from './lines.component';

const mockPageResponse: PageResponse<Line> = {
  content: [
    { id: '1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 },
  ],
  page: 0,
  size: 12,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};

describe('LinesComponent', () => {
  let component: LinesComponent;
  let fixture: ComponentFixture<LinesComponent>;
  let mockLineService: {
    getAllPaginated: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let queryParams$: BehaviorSubject<Record<string, string>>;
  let router: Router;

  beforeEach(() => {
    mockLineService = {
      getAllPaginated: vi.fn().mockReturnValue(of(mockPageResponse)),
      create: vi.fn().mockReturnValue(of({ id: '2', code: 'L2', name: 'New', color: '#00F', type: null, stopCount: 0, itineraryCount: 0 })),
      update: vi.fn().mockReturnValue(of({ id: '1', code: 'L1', name: 'Updated', color: '#0F0', type: null, stopCount: 5, itineraryCount: 2 })),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    const mockDialogRef = { afterClosed: () => of({ code: 'L2', name: 'New', color: '#00F' }) };
    mockDialog = { open: vi.fn().mockReturnValue(mockDialogRef) };
    mockSnackBar = { open: vi.fn() };
    queryParams$ = new BehaviorSubject<Record<string, string>>({});

    TestBed.configureTestingModule({
      imports: [LinesComponent],
      providers: [
        provideRouter([]),
        { provide: LineService, useValue: mockLineService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$ } },
      ],
    });

    fixture = TestBed.createComponent(LinesComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loading state', () => {
    it('should start with loading true', () => {
      expect(component.loading()).toBe(true);
    });

    it('should set loading to false after lines are loaded', () => {
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });

  describe('queryParams initialization', () => {
    it('should initialize state from query params', () => {
      queryParams$.next({ page: '2', size: '24', sortBy: 'name:desc', search: 'metro' });
      fixture.detectChanges();

      expect(component.page).toBe(2);
      expect(component.size).toBe(24);
      expect(component.sortBy).toBe('name:desc');
      expect(component.search).toBe('metro');
    });

    it('should use defaults when query params are empty', () => {
      fixture.detectChanges();

      expect(component.page).toBe(0);
      expect(component.size).toBe(12);
      expect(component.sortBy).toBe('code');
      expect(component.search).toBe('');
    });
  });

  describe('loadLines', () => {
    it('should call getAllPaginated with correct params', () => {
      fixture.detectChanges();

      expect(mockLineService.getAllPaginated).toHaveBeenCalledWith({
        page: 0,
        size: 12,
        sortBy: 'code',
        sortDir: 'asc',
        search: undefined,
      });
    });

    it('should parse sort direction from sortBy containing colon', () => {
      queryParams$.next({ sortBy: 'name:desc' });
      fixture.detectChanges();

      expect(mockLineService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'name', sortDir: 'desc' }),
      );
    });

    it('should pass search term when present', () => {
      queryParams$.next({ search: 'metro' });
      fixture.detectChanges();

      expect(mockLineService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'metro' }),
      );
    });

    it('should populate lines signal and totalElements on success', () => {
      fixture.detectChanges();

      expect(component.lines()).toEqual(mockPageResponse.content);
      expect(component.totalElements).toBe(1);
    });

    it('should handle error and show snackbar', () => {
      mockLineService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Server error', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });

    it('should show fallback error message when error has no message', () => {
      mockLineService.getAllPaginated.mockReturnValue(throwError(() => ({ error: {} })));
      fixture.detectChanges();

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to load lines', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });

  describe('onPageChange', () => {
    it('should update page and size then call updateUrl', () => {
      fixture.detectChanges();

      component.onPageChange({ pageIndex: 3, pageSize: 24, length: 100 });

      expect(component.page).toBe(3);
      expect(component.size).toBe(24);
      expect(router.navigate).toHaveBeenCalled();
    });
  });

  describe('onSearchChange', () => {
    it('should reset page to 0 and set search', () => {
      fixture.detectChanges();
      component.page = 5;

      component.onSearchChange('tram');

      expect(component.search).toBe('tram');
      expect(component.page).toBe(0);
      expect(router.navigate).toHaveBeenCalled();
    });
  });

  describe('onSortChange', () => {
    it('should reset page to 0 and call updateUrl', () => {
      fixture.detectChanges();
      component.page = 3;

      component.onSortChange();

      expect(component.page).toBe(0);
      expect(router.navigate).toHaveBeenCalled();
    });

    it('should include the new sortBy value in query params', () => {
      fixture.detectChanges();
      component.sortBy = 'name:desc';

      component.onSortChange();

      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: expect.anything(),
        queryParams: expect.objectContaining({ sortBy: 'name:desc' }),
        replaceUrl: true,
      });
    });
  });

  describe('updateUrl', () => {
    it('should include only non-default params in query', () => {
      fixture.detectChanges();
      component.page = 2;
      component.size = 24;
      component.sortBy = 'name:desc';
      component.search = 'bus';

      component.updateUrl();

      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: expect.anything(),
        queryParams: { page: 2, size: 24, sortBy: 'name:desc', search: 'bus' },
        replaceUrl: true,
      });
    });

    it('should omit default values from query params', () => {
      fixture.detectChanges();
      component.page = 0;
      component.size = 12;
      component.sortBy = 'code';
      component.search = '';

      component.updateUrl();

      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: expect.anything(),
        queryParams: {},
        replaceUrl: true,
      });
    });
  });

  describe('openCreateDialog', () => {
    it('should call create and reload on success', () => {
      const dialogResult = { code: 'L2', name: 'New', color: '#00F' };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(dialogResult) });
      fixture.detectChanges();
      mockLineService.getAllPaginated.mockClear();

      component.openCreateDialog();

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockLineService.create).toHaveBeenCalledWith(dialogResult);
      expect(mockLineService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Line created', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call create when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openCreateDialog();

      expect(mockLineService.create).not.toHaveBeenCalled();
    });

    it('should show error snackbar when create fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ code: 'L2', name: 'New', color: '#00F' }) });
      mockLineService.create.mockReturnValue(throwError(() => ({ error: { message: 'Duplicate code' } })));
      fixture.detectChanges();

      component.openCreateDialog();

      expect(mockSnackBar.open).toHaveBeenCalledWith('Duplicate code', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });

  describe('openEditDialog', () => {
    const existingLine: Line = { id: '1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 };

    it('should call update and reload on success', () => {
      const editResult = { code: 'L1', name: 'Updated', color: '#0F0' };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(editResult) });
      fixture.detectChanges();
      mockLineService.getAllPaginated.mockClear();

      component.openEditDialog(existingLine);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ data: { line: existingLine }, width: '450px' }),
      );
      expect(mockLineService.update).toHaveBeenCalledWith('1', editResult);
      expect(mockLineService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Line updated', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call update when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openEditDialog(existingLine);

      expect(mockLineService.update).not.toHaveBeenCalled();
    });

    it('should show error snackbar when update fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ code: 'L1', name: 'Updated', color: '#0F0' }) });
      mockLineService.update.mockReturnValue(throwError(() => ({ error: { message: 'Conflict' } })));
      fixture.detectChanges();

      component.openEditDialog(existingLine);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Conflict', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });

  describe('deleteLine', () => {
    const lineToDelete: Line = { id: '1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 };

    it('should call delete and show snackbar when confirmed', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      fixture.detectChanges();
      mockLineService.getAllPaginated.mockClear();

      component.deleteLine(lineToDelete);

      expect(mockLineService.delete).toHaveBeenCalledWith('1');
      expect(mockLineService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Line deleted', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call delete when cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });
      fixture.detectChanges();

      component.deleteLine(lineToDelete);

      expect(mockLineService.delete).not.toHaveBeenCalled();
    });

    it('should show error snackbar when delete fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      mockLineService.delete.mockReturnValue(throwError(() => ({ error: { message: 'Cannot delete' } })));
      fixture.detectChanges();

      component.deleteLine(lineToDelete);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Cannot delete', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });

    it('should show fallback error message when delete error has no message', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      mockLineService.delete.mockReturnValue(throwError(() => ({ error: {} })));
      fixture.detectChanges();

      component.deleteLine(lineToDelete);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to delete line', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });

  describe('onPageChange triggers reload', () => {
    it('should trigger loadLines via updateUrl which updates query params', () => {
      fixture.detectChanges();
      mockLineService.getAllPaginated.mockClear();

      // Update query params simulating navigation
      queryParams$.next({ page: '1', size: '24' });

      expect(mockLineService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, size: 24 }),
      );
    });
  });
});
