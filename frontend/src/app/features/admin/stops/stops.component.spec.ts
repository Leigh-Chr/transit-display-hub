import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
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
  lines: [{ id: 'line-1', code: 'L1', name: 'Line 1', color: '#F00' }],
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

  let mockNotify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

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

    mockNotify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    mockRoute = {
      queryParams: queryParams$,
    };

    TestBed.configureTestingModule({
      imports: [StopsComponent],
      providers: [
        provideRouter([]),
        { provide: LineService, useValue: mockLineService },
        { provide: StopService, useValue: mockStopService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: NotifyService, useValue: mockNotify },
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

      expect(component.tableState.page).toBe(2);
      expect(component.tableState.size).toBe(25);
      expect(component.tableState.sortBy).toBe('scheduleCount');
      expect(component.tableState.sortDir).toBe('desc');
      expect(component.tableState.search).toBe('central');
      expect(component.lineId).toBe('l1');
    });
  });

  describe('loadStops', () => {
    it('should call getAllPaginated with correct params', () => {
      component.ngOnInit();
      component.tableState.page = 1;
      component.tableState.size = 25;
      component.tableState.sortBy = 'scheduleCount';
      component.tableState.sortDir = 'desc';
      component.tableState.search = 'central';
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
      component.ngOnInit();
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
      expect(mockNotify.error).toHaveBeenCalledWith('Server error');
    });

    it('should show fallback message when error has no message', () => {
      mockStopService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: {} }))
      );

      component.loadStops();

      expect(mockNotify.error).toHaveBeenCalledWith('Failed to load stops');
    });
  });

  describe('onLineChange', () => {
    it('should set lineId and reset page to 0', () => {
      component.ngOnInit();
      component.tableState.page = 3;
      component.lineId = '';

      component.onLineChange('l1');

      expect(component.lineId).toBe('l1');
      expect(component.tableState.page).toBe(0);
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
      expect(mockNotify.success).toHaveBeenCalledWith('Stop created');
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
      expect(mockNotify.success).toHaveBeenCalledWith('Stop updated');
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
      expect(mockNotify.success).toHaveBeenCalledWith('Stop deleted');
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
