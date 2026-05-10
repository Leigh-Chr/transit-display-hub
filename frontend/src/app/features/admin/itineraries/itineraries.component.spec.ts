import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ItineraryService } from '@core/api/itinerary.service';
import { LineService } from '@core/api/line.service';
import { AuthService } from '@core/auth/auth.service';
import { Itinerary, Line, PageResponse } from '@shared/models';
import { ItinerariesComponent } from './itineraries.component';
import { TranslocoTestingModule } from '@jsverse/transloco';

const translocoLang = {
  admin: {
    itineraries: {
      loadFailed: 'Failed to load itineraries',
      loadLinesFailed: 'Failed to load lines',
      createSuccess: 'Itinerary created',
      updateSuccess: 'Itinerary updated',
      deleteSuccess: 'Itinerary deleted',
      stopsUpdated: 'Stops updated',
      createFailed: 'Failed to create itinerary',
      updateFailed: 'Failed to update itinerary',
      deleteFailed: 'Failed to delete itinerary',
      stopsUpdateFailed: 'Failed to update stops',
      confirm: { deleteTitle: 'Delete Itinerary', deleteMessage: 'Delete itinerary?' },
    },
    common: {},
    navigation: {},
  },
  common: { delete: 'Delete' },
};

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
      directionId: null,
  line: { id: 'line-1', code: 'L1', name: 'Line 1', color: '#FF0000' },
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
  let mockNotify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
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
    mockNotify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    queryParams$ = new BehaviorSubject<Record<string, string>>({});

    TestBed.configureTestingModule({
      imports: [
        ItinerariesComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: translocoLang, fr: translocoLang },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ItineraryService, useValue: mockItineraryService },
        { provide: LineService, useValue: mockLineService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: NotifyService, useValue: mockNotify },
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

      expect(component.tableState.page).toBe(2);
      expect(component.tableState.size).toBe(25);
      expect(component.tableState.sortBy).toBe('terminusName');
      expect(component.tableState.sortDir).toBe('desc');
      expect(component.tableState.search).toBe('north');
      expect(component.lineId).toBe('l1');
    });

    it('should use defaults when query params are empty', () => {
      fixture.detectChanges();

      expect(component.tableState.page).toBe(0);
      expect(component.tableState.size).toBe(10);
      expect(component.tableState.sortBy).toBe('name');
      expect(component.tableState.sortDir).toBe('asc');
      expect(component.tableState.search).toBe('');
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

    it('should handle error and show error notification with server message', () => {
      mockItineraryService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(mockNotify.error).toHaveBeenCalledWith('Server error');
    });

    it('should show fallback error message when error has no message', () => {
      mockItineraryService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: {} })),
      );
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(mockNotify.error).toHaveBeenCalledWith('Failed to load itineraries');
    });
  });

  describe('displayedColumns', () => {
    it('should include actions column when user is admin', () => {
      mockAuthService.isAdmin.set(true);

      expect(component.displayedColumns).toEqual([
        'line', 'name', 'terminusName', 'direction', 'stops', 'amenities', 'actions',
      ]);
    });

    it('should exclude actions column when user is not admin', () => {
      mockAuthService.isAdmin.set(false);

      expect(component.displayedColumns).toEqual([
        'line', 'name', 'terminusName', 'direction', 'stops', 'amenities',
      ]);
    });
  });

  describe('tableState delegation', () => {
    it('writes lineId from the extras supplier on URL updates', () => {
      fixture.detectChanges();
      component.lineId = 'l1';

      component.tableState.updateUrl();

      const last = (router.navigate as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1);
      const args = last as [unknown, { queryParams: Record<string, unknown> }] | undefined;
      expect(args?.[1].queryParams).toEqual(expect.objectContaining({ lineId: 'l1' }));
    });
  });

  describe('onLineChange', () => {
    it('should set lineId and reset page to 0', () => {
      fixture.detectChanges();
      component.tableState.page = 2;

      component.onLineChange('l1');

      expect(component.lineId).toBe('l1');
      expect(component.tableState.page).toBe(0);
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
      expect(mockNotify.success).toHaveBeenCalledWith('Itinerary created');
    });

    it('should not call create when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openCreateDialog();

      expect(mockItineraryService.create).not.toHaveBeenCalled();
    });

    it('should show error notification when create fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ lineId: 'l1', name: 'South' }) });
      mockItineraryService.create.mockReturnValue(throwError(() => ({ error: { message: 'Duplicate name' } })));
      fixture.detectChanges();

      component.openCreateDialog();

      expect(mockNotify.error).toHaveBeenCalledWith('Duplicate name');
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
      expect(mockNotify.success).toHaveBeenCalledWith('Itinerary updated');
    });

    it('should not call update when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openEditDialog(mockItinerary);

      expect(mockItineraryService.update).not.toHaveBeenCalled();
    });

    it('should show error notification when update fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ lineId: 'l1', name: 'Updated' }) });
      mockItineraryService.update.mockReturnValue(throwError(() => ({ error: { message: 'Conflict' } })));
      fixture.detectChanges();

      component.openEditDialog(mockItinerary);

      expect(mockNotify.error).toHaveBeenCalledWith('Conflict');
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
      expect(mockNotify.success).toHaveBeenCalledWith('Stops updated');
    });

    it('should not call updateStops when dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      fixture.detectChanges();

      component.openStopsDialog(mockItinerary);

      expect(mockItineraryService.updateStops).not.toHaveBeenCalled();
    });

    it('should show error notification when updateStops fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of({ stopIds: ['s1'] }) });
      mockItineraryService.updateStops.mockReturnValue(
        throwError(() => ({ error: { message: 'Invalid stop' } })),
      );
      fixture.detectChanges();

      component.openStopsDialog(mockItinerary);

      expect(mockNotify.error).toHaveBeenCalledWith('Invalid stop');
    });
  });

  describe('deleteItinerary', () => {
    it('should call delete and show success notification when confirmed', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      fixture.detectChanges();
      mockItineraryService.getAllPaginated.mockClear();

      component.deleteItinerary(mockItinerary);

      expect(mockItineraryService.delete).toHaveBeenCalledWith('i1');
      expect(mockItineraryService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('Itinerary deleted');
    });

    it('should not call delete when cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });
      fixture.detectChanges();

      component.deleteItinerary(mockItinerary);

      expect(mockItineraryService.delete).not.toHaveBeenCalled();
    });

    it('should show error notification when delete fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      mockItineraryService.delete.mockReturnValue(
        throwError(() => ({ error: { message: 'Cannot delete' } })),
      );
      fixture.detectChanges();

      component.deleteItinerary(mockItinerary);

      expect(mockNotify.error).toHaveBeenCalledWith('Cannot delete');
    });
  });
});
