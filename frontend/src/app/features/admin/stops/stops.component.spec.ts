import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { of, throwError, Subject, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { Line, Stop, PageResponse } from '@shared/models';
import { StopsComponent } from './stops.component';
import { testTranslocoModule } from '../../../../test-translations';

async function detectAndFlush(f: ComponentFixture<unknown>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
}

const en = {
  common: { delete: 'Delete' },
  admin: {
    stops: {
      loadFailed: 'Failed to load stops',
      loadLinesFailed: 'Failed to load lines',
      createSuccess: 'Stop created',
      updateSuccess: 'Stop updated',
      deleteSuccess: 'Stop deleted',
      createFailed: 'Failed to create stop',
      updateFailed: 'Failed to update stop',
      deleteFailed: 'Failed to delete stop',
      dialog: { titleCreate: 'New Stop', titleEdit: 'Edit Stop' },
      confirm: { deleteTitle: 'Delete Stop', deleteMessage: 'Delete stop "{{ name }}"?' },
    },
  },
};

const fr = {
  common: { delete: 'Supprimer' },
  admin: {
    stops: {
      loadFailed: 'Échec du chargement des arrêts',
      loadLinesFailed: 'Échec du chargement des lignes',
      createSuccess: 'Arrêt créé',
      updateSuccess: 'Arrêt mis à jour',
      deleteSuccess: 'Arrêt supprimé',
      createFailed: "Échec de la création de l'arrêt",
      updateFailed: "Échec de la mise à jour de l'arrêt",
      deleteFailed: "Échec de la suppression de l'arrêt",
      dialog: { titleCreate: 'Nouvel arrêt', titleEdit: "Modifier l'arrêt" },
      confirm: { deleteTitle: "Supprimer l'arrêt", deleteMessage: 'Supprimer l\'arrêt "{{ name }}" ?' },
    },
  },
};

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
  let router: Router;

  let mockLineService: {
    getAll: ReturnType<typeof vi.fn>;
  };

  let mockStopService: {
    getAllPaginated: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };

  let mockNotify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

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
    };

    mockDialog = {
      open: vi.fn(),
    };

    mockNotify = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      imports: [
        StopsComponent,
        testTranslocoModule(en, fr),
      ],
      providers: [
        provideRouter([]),
        { provide: LineService, useValue: mockLineService },
        { provide: StopService, useValue: mockStopService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: NotifyService, useValue: mockNotify },
        { provide: ActivatedRoute, useValue: { queryParams: queryParams$ } },
      ],
    });

    fixture = TestBed.createComponent(StopsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loading state', () => {
    it('should be loading after detectChanges (resource initiated)', () => {
      fixture.detectChanges();
      expect(component.loading()).toBe(true);
    });

    it('should set loading to false after stops are loaded', async () => {
      await detectAndFlush(fixture);
      expect(component.loading()).toBe(false);
    });
  });

  describe('lines resource', () => {
    it('should load lines on init', async () => {
      await detectAndFlush(fixture);
      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(component.lines()).toEqual([mockLine]);
    });

    it('should show error when lines fail to load', async () => {
      mockLineService.getAll.mockReturnValue(throwError(() => new Error('network')));
      await detectAndFlush(fixture);
      expect(mockNotify.error).toHaveBeenCalledWith('Failed to load lines');
    });
  });

  describe('queryParams initialization', () => {
    it('should initialize state from query params', async () => {
      queryParams$.next({ page: '2', size: '25', sortBy: 'scheduleCount', sortDir: 'desc', search: 'central', lineId: 'l1' });
      await detectAndFlush(fixture);

      expect(component.tableState.page).toBe(2);
      expect(component.tableState.size).toBe(25);
      expect(component.tableState.sortBy).toBe('scheduleCount');
      expect(component.tableState.sortDir).toBe('desc');
      expect(component.tableState.search).toBe('central');
      expect(component.lineId()).toBe('l1');
    });

    it('should use defaults when query params are empty', async () => {
      await detectAndFlush(fixture);

      expect(component.tableState.page).toBe(0);
      expect(component.tableState.size).toBe(10);
      expect(component.tableState.sortBy).toBe('name');
      expect(component.lineId()).toBe('');
    });
  });

  describe('loadStops', () => {
    it('should call getAllPaginated with correct params', async () => {
      await detectAndFlush(fixture);

      expect(mockStopService.getAllPaginated).toHaveBeenCalledWith({
        page: 0,
        size: 10,
        sortBy: 'name',
        sortDir: 'asc',
        search: undefined,
        lineId: undefined,
      });
    });

    it('should pass lineId when set via query params', async () => {
      queryParams$.next({ lineId: 'l1' });
      await detectAndFlush(fixture);

      expect(mockStopService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ lineId: 'l1' }),
      );
    });

    it('should pass search term when present', async () => {
      queryParams$.next({ search: 'central' });
      await detectAndFlush(fixture);

      expect(mockStopService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'central' }),
      );
    });

    it('should populate stops and totalElements on success', async () => {
      await detectAndFlush(fixture);

      expect(component.stops()).toEqual([mockStop]);
      expect(component.totalElements()).toBe(1);
    });

    it('should surface load errors via the resource error state, not via a snackbar', async () => {
      mockStopService.getAllPaginated.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );
      await detectAndFlush(fixture);

      expect(component.loading()).toBe(false);
      expect(component.loadError()).toBeTruthy();
      expect(mockNotify.error).not.toHaveBeenCalled();
    });

    it('should render an error empty-state when the resource errors', async () => {
      mockStopService.getAllPaginated.mockReturnValue(throwError(() => ({ error: {} })));
      await detectAndFlush(fixture);

      const errorState = fixture.nativeElement.querySelector('app-empty-state[icon="error_outline"]');
      expect(errorState).toBeTruthy();
    });
  });

  describe('onLineChange', () => {
    it('should set lineId signal and reset page to 0', () => {
      fixture.detectChanges();
      component.tableState.page = 3;

      component.onLineChange('l1');

      expect(component.lineId()).toBe('l1');
      expect(component.tableState.page).toBe(0);
      expect(router.navigate).toHaveBeenCalled();
    });
  });

  describe('openCreateDialog', () => {
    it('should pass lines and selectedLineId in dialog data', async () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      await detectAndFlush(fixture);

      component.lineId.set('l1');
      component.openCreateDialog();

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          data: expect.objectContaining({
            lines: [mockLine],
            selectedLineId: 'l1',
          }),
          width: '450px',
          ariaLabel: 'New Stop',
        }),
      );
    });

    it('should reload and notify on dialog success', async () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      await detectAndFlush(fixture);
      mockStopService.getAllPaginated.mockClear();

      component.openCreateDialog();
      afterClosed$.next(mockStop);
      await fixture.whenStable();

      expect(mockStopService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('Stop created');
    });

    it('should pass a submit callback that calls stopService.create', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      fixture.detectChanges();

      component.openCreateDialog();

      const passedData = mockDialog.open.mock.calls[0]![1].data;
      const createRequest = { name: 'New Stop', lineIds: ['l1'] };
      passedData.submit(createRequest);
      expect(mockStopService.create).toHaveBeenCalledWith(createRequest);
    });

    it('should not notify success when dialog is cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      fixture.detectChanges();

      component.openCreateDialog();
      afterClosed$.next(undefined);

      expect(mockNotify.success).not.toHaveBeenCalled();
    });

    it('should expose an onError that surfaces the failure via notify', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      fixture.detectChanges();

      component.openCreateDialog();
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: { message: 'Duplicate stop' } });

      expect(mockNotify.error).toHaveBeenCalledWith('Duplicate stop');
    });
  });

  describe('openEditDialog', () => {
    it('should reload and notify on dialog success', async () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      await detectAndFlush(fixture);
      mockStopService.getAllPaginated.mockClear();

      component.openEditDialog(mockStop);

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          data: expect.objectContaining({
            stop: mockStop,
            lines: [mockLine],
          }),
          width: '450px',
          ariaLabel: 'Edit Stop',
        }),
      );

      afterClosed$.next(mockStop);
      await fixture.whenStable();

      expect(mockStopService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('Stop updated');
    });

    it('should pass a submit callback that calls stopService.update', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      fixture.detectChanges();

      component.openEditDialog(mockStop);

      const passedData = mockDialog.open.mock.calls[0]![1].data;
      const updateRequest = { name: 'Updated Stop', lineIds: ['l1'] };
      passedData.submit(updateRequest);
      expect(mockStopService.update).toHaveBeenCalledWith('s1', updateRequest);
    });

    it('should not notify success when dialog is cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      fixture.detectChanges();

      component.openEditDialog(mockStop);
      afterClosed$.next(undefined);

      expect(mockNotify.success).not.toHaveBeenCalled();
    });

    it('should expose an onError that surfaces the failure via notify', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      fixture.detectChanges();

      component.openEditDialog(mockStop);
      const passedData = mockDialog.open.mock.calls[0]![1].data;
      passedData.onError({ error: { message: 'Conflict' } });

      expect(mockNotify.error).toHaveBeenCalledWith('Conflict');
    });
  });

  describe('deleteStop', () => {
    it('should delete stop and reload when confirmed', async () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      await detectAndFlush(fixture);
      mockStopService.getAllPaginated.mockClear();

      component.deleteStop(mockStop);
      afterClosed$.next(true);
      await fixture.whenStable();

      expect(mockStopService.delete).toHaveBeenCalledWith('s1');
      expect(mockStopService.getAllPaginated).toHaveBeenCalled();
      expect(mockNotify.success).toHaveBeenCalledWith('Stop deleted');
    });

    it('should skip deletion when cancelled', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      fixture.detectChanges();

      component.deleteStop(mockStop);
      afterClosed$.next(false);

      expect(mockStopService.delete).not.toHaveBeenCalled();
    });

    it('should show error snackbar when delete fails', () => {
      const afterClosed$ = new Subject<unknown>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosed$ });
      mockStopService.delete.mockReturnValue(throwError(() => ({ error: { message: 'Cannot delete' } })));
      fixture.detectChanges();

      component.deleteStop(mockStop);
      afterClosed$.next(true);

      expect(mockNotify.error).toHaveBeenCalledWith('Cannot delete');
    });
  });

  describe('onPageChange triggers reload', () => {
    it('should trigger loadStops when query params change', async () => {
      await detectAndFlush(fixture);
      mockStopService.getAllPaginated.mockClear();

      queryParams$.next({ page: '1', size: '25' });
      await fixture.whenStable();

      expect(mockStopService.getAllPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, size: 25 }),
      );
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
