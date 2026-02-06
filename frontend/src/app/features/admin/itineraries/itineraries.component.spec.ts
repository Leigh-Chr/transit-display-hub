import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ItineraryService } from '@core/api/itinerary.service';
import { LineService } from '@core/api/line.service';
import { AuthService } from '@core/auth/auth.service';
import { Itinerary, Line, PageResponse } from '@shared/models';
import { ItinerariesComponent } from './itineraries.component';

const mockLine: Line = {
  id: 'l1',
  code: 'L1',
  name: 'Line 1',
  color: '#FF0000',
  type: null,
  stopCount: 2,
  itineraryCount: 1,
};

const mockItinerary: Itinerary = {
  id: 'i1',
  name: 'North',
  terminusName: 'Terminal N',
  line: { code: 'L1', name: 'Line 1', color: '#FF0000' },
  stops: [{ id: 's1', name: 'Stop 1', position: 0 }],
};

const mockPageResponse: PageResponse<Itinerary> = {
  content: [mockItinerary],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};

const emptyPageResponse: PageResponse<Itinerary> = {
  content: [],
  page: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};

describe('ItinerariesComponent', () => {
  let component: ItinerariesComponent;
  let fixture: ComponentFixture<ItinerariesComponent>;
  let mockItineraryService: {
    getAllPaginated: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStops: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLineService: { getAll: ReturnType<typeof vi.fn> };
  let mockAuthService: { isAdmin: ReturnType<typeof signal<boolean>> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let queryParams$: BehaviorSubject<Record<string, string>>;
  let router: Router;

  beforeEach(() => {
    mockItineraryService = {
      getAllPaginated: vi.fn().mockReturnValue(of(emptyPageResponse)),
      create: vi.fn().mockReturnValue(of(mockItinerary)),
      update: vi.fn().mockReturnValue(of(mockItinerary)),
      updateStops: vi.fn().mockReturnValue(of(mockItinerary)),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    mockLineService = { getAll: vi.fn().mockReturnValue(of([mockLine])) };
    mockAuthService = { isAdmin: signal(true) };
    mockDialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(undefined) }) };
    mockSnackBar = { open: vi.fn() };
    queryParams$ = new BehaviorSubject<Record<string, string>>({});

    TestBed.configureTestingModule({
      imports: [ItinerariesComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ItineraryService, useValue: mockItineraryService },
        { provide: LineService, useValue: mockLineService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$ } },
      ],
    });

    fixture = TestBed.createComponent(ItinerariesComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load lines and itineraries', () => {
      fixture.detectChanges();

      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(component.lines()).toEqual([mockLine]);
      expect(mockItineraryService.getAllPaginated).toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('should initialize state from query params', () => {
      queryParams$.next({
        page: '2',
        size: '25',
        sortBy: 'terminusName',
        sortDir: 'desc',
        search: 'north',
        lineId: 'l1',
      });
      fixture.detectChanges();

      expect(component.page).toBe(2);
      expect(component.size).toBe(25);
      expect(component.sortBy).toBe('terminusName');
      expect(component.sortDir).toBe('desc');
      expect(component.search).toBe('north');
      expect(component.lineId).toBe('l1');
    });

    it('should use defaults when query params are empty', () => {
      fixture.detectChanges();

      expect(component.page).toBe(0);
      expect(component.size).toBe(10);
      expect(component.sortBy).toBe('name');
      expect(component.sortDir).toBe('asc');
      expect(component.search).toBe('');
      expect(component.lineId).toBe('');
    });
  });

  describe('loadItineraries', () => {
    it('should call getAllPaginated with correct params', () => {
      fixture.detectChanges();

      expect(mockItineraryService.getAllPaginated).toHaveBeenCalledWith({
        page: 0,
        size: 10,
        sortBy: 'name',
        sortDir: 'asc',
        search: undefined,
        lineId: undefined,
      });
    });

    it('should pass search and lineId when present', () => {
      queryParams$.next({ search: 'north', lineId: 'l1' });
      fixture.detectChanges();

      expect(mockItineraryService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'north', lineId: 'l1' }),
      );
    });

    it('should populate dataSource and totalElements on success', () => {
      mockItineraryService.getAllPaginated.mockReturnValue(of(mockPageResponse));
      component.ngOnInit();

      expect(component.dataSource.data).toEqual([mockItinerary]);
      expect(component.totalElements).toBe(1);
      expect(component.loading()).toBe(false);
    });

    it('should handle error and show snackbar with server message', () => {
      mockItineraryService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Server error', 'Close', { duration: 5000 });
    });

    it('should show fallback error message when error has no message', () => {
      mockItineraryService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: {} })),
      );
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to load itineraries', 'Close', { duration: 5000 });
    });
  });

  describe('displayedColumns', () => {
    it('should include actions column when user is admin', () => {
      mockAuthService.isAdmin.set(true);

      expect(component.displayedColumns).toEqual(['line', 'name', 'terminusName', 'stops', 'actions']);
    });

    it('should exclude actions column when user is not admin', () => {
      mockAuthService.isAdmin.set(false);

      expect(component.displayedColumns).toEqual(['line', 'name', 'terminusName', 'stops']);
    });
  });

  describe('onPageChange', () => {
    it('should update page and size then navigate', () => {
      fixture.detectChanges();

      component.onPageChange({ pageIndex: 3, pageSize: 25, length: 100 });

      expect(component.page).toBe(3);
      expect(component.size).toBe(25);
      expect(router.navigate).toHaveBeenCalled();
    });
  });

  describe('onSearchChange', () => {
    it('should reset page to 0 and set search', () => {
      fixture.detectChanges();
      component.page = 5;

      component.onSearchChange('terminal');

      expect(component.search).toBe('terminal');
      expect(component.page).toBe(0);
      expect(router.navigate).toHaveBeenCalled();
    });
  });

  describe('onSortChange', () => {
    it('should update sortBy, sortDir and reset page to 0', () => {
      fixture.detectChanges();
      component.page = 3;

      component.onSortChange({ active: 'terminusName', direction: 'desc' });

      expect(component.sortBy).toBe('terminusName');
      expect(component.sortDir).toBe('desc');
      expect(component.page).toBe(0);
      expect(router.navigate).toHaveBeenCalled();
    });

    it('should default to asc when direction is empty', () => {
      fixture.detectChanges();

      component.onSortChange({ active: 'name', direction: '' });

      expect(component.sortDir).toBe('asc');
    });
  });

  describe('onLineChange', () => {
    it('should set lineId and reset page to 0', () => {
      fixture.detectChanges();
      component.page = 2;

      component.onLineChange('l1');

      expect(component.lineId).toBe('l1');
      expect(component.page).toBe(0);
      expect(router.navigate).toHaveBeenCalled();
    });

    it('should clear lineId when empty string is provided', () => {
      fixture.detectChanges();
      component.lineId = 'l1';

      component.onLineChange('');

      expect(component.lineId).toBe('');
    });
  });

  describe('openCreateDialog', () => {
    it('should call create and reload on success', () => {
      const dialogResult = { lineId: 'l1', name: 'South' };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(dialogResult) });
      fixture.detectChanges();
      mockItineraryService.getAllPaginated.mockClear();

      component.openCreateDialog();

      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockItineraryService.create).toHaveBeenCalledWith(dialogResult);
      expect(mockItineraryService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Itinerary created', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call create when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openCreateDialog();

      expect(mockItineraryService.create).not.toHaveBeenCalled();
    });

    it('should show error snackbar when create fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ lineId: 'l1', name: 'South' }) });
      mockItineraryService.create.mockReturnValue(throwError(() => ({ error: { message: 'Duplicate name' } })));
      fixture.detectChanges();

      component.openCreateDialog();

      expect(mockSnackBar.open).toHaveBeenCalledWith('Duplicate name', 'Close', { duration: 5000 });
    });
  });

  describe('openEditDialog', () => {
    it('should call update and reload on success', () => {
      const editResult = { lineId: 'l1', name: 'Updated North' };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(editResult) });
      fixture.detectChanges();
      mockItineraryService.getAllPaginated.mockClear();

      component.openEditDialog(mockItinerary);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { itinerary: mockItinerary, lines: [mockLine] },
          width: '450px',
        }),
      );
      expect(mockItineraryService.update).toHaveBeenCalledWith('i1', editResult);
      expect(mockItineraryService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Itinerary updated', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call update when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openEditDialog(mockItinerary);

      expect(mockItineraryService.update).not.toHaveBeenCalled();
    });

    it('should show error snackbar when update fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ lineId: 'l1', name: 'Updated' }) });
      mockItineraryService.update.mockReturnValue(throwError(() => ({ error: { message: 'Conflict' } })));
      fixture.detectChanges();

      component.openEditDialog(mockItinerary);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Conflict', 'Close', { duration: 5000 });
    });
  });

  describe('openStopsDialog', () => {
    it('should call updateStops and reload on success', () => {
      const stopsResult = { stopIds: ['s1', 's2'] };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(stopsResult) });
      fixture.detectChanges();
      mockItineraryService.getAllPaginated.mockClear();

      component.openStopsDialog(mockItinerary);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: { itinerary: mockItinerary },
          width: '500px',
        }),
      );
      expect(mockItineraryService.updateStops).toHaveBeenCalledWith('i1', stopsResult);
      expect(mockItineraryService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Stops updated', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call updateStops when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openStopsDialog(mockItinerary);

      expect(mockItineraryService.updateStops).not.toHaveBeenCalled();
    });

    it('should show error snackbar when updateStops fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ stopIds: ['s1'] }) });
      mockItineraryService.updateStops.mockReturnValue(
        throwError(() => ({ error: { message: 'Invalid stop' } })),
      );
      fixture.detectChanges();

      component.openStopsDialog(mockItinerary);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Invalid stop', 'Close', { duration: 5000 });
    });
  });

  describe('deleteItinerary', () => {
    it('should call delete and show snackbar when confirmed', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      fixture.detectChanges();
      mockItineraryService.getAllPaginated.mockClear();

      component.deleteItinerary(mockItinerary);

      expect(mockItineraryService.delete).toHaveBeenCalledWith('i1');
      expect(mockItineraryService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Itinerary deleted', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call delete when cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });
      fixture.detectChanges();

      component.deleteItinerary(mockItinerary);

      expect(mockItineraryService.delete).not.toHaveBeenCalled();
    });

    it('should show error snackbar when delete fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      mockItineraryService.delete.mockReturnValue(
        throwError(() => ({ error: { message: 'Cannot delete' } })),
      );
      fixture.detectChanges();

      component.deleteItinerary(mockItinerary);

      expect(mockSnackBar.open).toHaveBeenCalledWith('Cannot delete', 'Close', { duration: 5000 });
    });
  });
});
