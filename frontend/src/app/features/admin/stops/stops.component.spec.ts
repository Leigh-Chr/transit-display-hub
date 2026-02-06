import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError, Subject, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { Line, Stop, PageResponse } from '@shared/models';
import { StopsComponent } from './stops.component';

const mockLine: Line = {
  id: 'l1',
  code: 'L1',
  name: 'Line 1',
  color: '#F00',
  type: null,
  stopCount: 2,
  itineraryCount: 1,
};

const mockStop: Stop = {
  id: 's1',
  name: 'Central',
  latitude: 48.8,
  longitude: 2.3,
  lines: [{ code: 'L1', name: 'Line 1', color: '#F00' }],
  scheduleCount: 5,
  hasDevice: true,
};

const mockPageResponse: PageResponse<Stop> = {
  content: [mockStop],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
  first: true,
  last: true,
};

describe('StopsComponent', () => {
  let component: StopsComponent;
  let fixture: ComponentFixture<StopsComponent>;
  let queryParams$: BehaviorSubject<Record<string, string>>;

  let mockLineService: {
    getAll: ReturnType<typeof vi.fn>;
  };

  let mockStopService: {
    getAllPaginated: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };

  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockRoute: {
    queryParams: BehaviorSubject<Record<string, string>>;
  };

  beforeEach(() => {
    queryParams$ = new BehaviorSubject<Record<string, string>>({});

    mockLineService = {
      getAll: vi.fn().mockReturnValue(of([mockLine])),
    };

    mockStopService = {
      getAllPaginated: vi.fn().mockReturnValue(of(mockPageResponse)),
      create: vi.fn().mockReturnValue(of(mockStop)),
      update: vi.fn().mockReturnValue(of(mockStop)),
      delete: vi.fn().mockReturnValue(of(void 0)),
      getAll: vi.fn().mockReturnValue(of([mockStop])),
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    mockRoute = {
      queryParams: queryParams$,
    };

    TestBed.configureTestingModule({
      imports: [StopsComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: LineService, useValue: mockLineService },
        { provide: StopService, useValue: mockStopService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    });

    fixture = TestBed.createComponent(StopsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load lines on init', () => {
      component.ngOnInit();

      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(component.lines()).toEqual([mockLine]);
    });

    it('should subscribe to queryParams and load stops', () => {
      component.ngOnInit();

      expect(mockStopService.getAllPaginated).toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('should parse queryParams into component state', () => {
      queryParams$.next({
        page: '2',
        size: '25',
        sortBy: 'scheduleCount',
        sortDir: 'desc',
        search: 'central',
        lineId: 'l1',
      });

      component.ngOnInit();

      expect(component.page).toBe(2);
      expect(component.size).toBe(25);
      expect(component.sortBy).toBe('scheduleCount');
      expect(component.sortDir).toBe('desc');
      expect(component.search).toBe('central');
      expect(component.lineId).toBe('l1');
    });
  });

  describe('loadStops', () => {
    it('should call getAllPaginated with correct params', () => {
      component.page = 1;
      component.size = 25;
      component.sortBy = 'scheduleCount';
      component.sortDir = 'desc';
      component.search = 'central';
      component.lineId = 'l1';

      component.loadStops();

      expect(mockStopService.getAllPaginated).toHaveBeenCalledWith({
        page: 1,
        size: 25,
        sortBy: 'scheduleCount',
        sortDir: 'desc',
        search: 'central',
        lineId: 'l1',
      });
    });

    it('should pass undefined for empty search and lineId', () => {
      component.page = 0;
      component.size = 10;
      component.sortBy = 'name';
      component.sortDir = 'asc';
      component.search = '';
      component.lineId = '';

      component.loadStops();

      expect(mockStopService.getAllPaginated).toHaveBeenCalledWith({
        page: 0,
        size: 10,
        sortBy: 'name',
        sortDir: 'asc',
        search: undefined,
        lineId: undefined,
      });
    });

    it('should update dataSource and totalElements on success', () => {
      component.loadStops();

      expect(component.dataSource.data).toEqual([mockStop]);
      expect(component.totalElements).toBe(1);
      expect(component.loading()).toBe(false);
    });

    it('should handle error and show snackbar', () => {
      mockStopService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } }))
      );

      component.loadStops();

      expect(component.loading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Server error', 'Close', {
        duration: 5000,
        panelClass: 'error-snackbar',
      });
    });

    it('should show fallback message when error has no message', () => {
      mockStopService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: {} }))
      );

      component.loadStops();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to load stops',
        'Close',
        { duration: 5000, panelClass: 'error-snackbar' }
      );
    });
  });

  describe('onLineChange', () => {
    it('should set lineId and reset page to 0', () => {
      component.page = 3;
      component.lineId = '';

      component.onLineChange('l1');

      expect(component.lineId).toBe('l1');
      expect(component.page).toBe(0);
    });
  });

  describe('onSearchChange', () => {
    it('should set search and reset page to 0', () => {
      component.page = 5;

      component.onSearchChange('central');

      expect(component.search).toBe('central');
      expect(component.page).toBe(0);
    });
  });

  describe('onSortChange', () => {
    it('should update sortBy, sortDir and reset page to 0', () => {
      component.page = 2;

      component.onSortChange({ active: 'scheduleCount', direction: 'desc' });

      expect(component.sortBy).toBe('scheduleCount');
      expect(component.sortDir).toBe('desc');
      expect(component.page).toBe(0);
    });

    it('should default to asc when direction is empty', () => {
      component.onSortChange({ active: 'name', direction: '' });

      expect(component.sortDir).toBe('asc');
    });
  });

  describe('onPageChange', () => {
    it('should update page and size', () => {
      component.onPageChange({
        pageIndex: 3,
        pageSize: 25,
        length: 100,
      });

      expect(component.page).toBe(3);
      expect(component.size).toBe(25);
    });
  });

  describe('openCreateDialog', () => {
    it('should pass lines and selectedLineId in dialog data', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.lines.set([mockLine]);
      component.lineId = 'l1';

      component.openCreateDialog();

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          data: {
            lines: [mockLine],
            selectedLineId: 'l1',
          },
          width: '450px',
          ariaLabel: 'Create new stop',
        })
      );
    });

    it('should create stop and reload on dialog success', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.openCreateDialog();

      const createRequest = { name: 'New Stop', lineIds: ['l1'] };
      afterClosed$.next(createRequest);

      expect(mockStopService.create).toHaveBeenCalledWith(createRequest);
      expect(mockStopService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Stop created', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should do nothing when dialog is cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.openCreateDialog();

      afterClosed$.next(undefined);

      expect(mockStopService.create).not.toHaveBeenCalled();
    });
  });

  describe('openEditDialog', () => {
    it('should update stop and reload on dialog success', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.lines.set([mockLine]);
      component.openEditDialog(mockStop);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          data: {
            stop: mockStop,
            lines: [mockLine],
          },
          width: '450px',
          ariaLabel: 'Edit stop Central',
        })
      );

      const updateRequest = { name: 'Updated Stop', lineIds: ['l1'] };
      afterClosed$.next(updateRequest);

      expect(mockStopService.update).toHaveBeenCalledWith('s1', updateRequest);
      expect(mockStopService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Stop updated', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });
  });

  describe('deleteStop', () => {
    it('should delete stop and reload when confirmed', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.deleteStop(mockStop);

      afterClosed$.next(true);

      expect(mockStopService.delete).toHaveBeenCalledWith('s1');
      expect(mockStopService.getAllPaginated).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith('Stop deleted', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should skip deletion when cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });

      component.deleteStop(mockStop);

      afterClosed$.next(false);

      expect(mockStopService.delete).not.toHaveBeenCalled();
    });
  });

  describe('openKioskPreview', () => {
    it('should open correct URL in new window', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      component.openKioskPreview('s1');

      expect(openSpy).toHaveBeenCalledWith('/display/s1', '_blank');

      openSpy.mockRestore();
    });
  });
});
