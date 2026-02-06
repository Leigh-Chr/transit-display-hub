import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { ScheduleService } from '@core/api/schedule.service';
import { Line, Stop, Schedule } from '@shared/models';
import { SchedulesComponent } from './schedules.component';
import { ScheduleDialogComponent } from './schedule-dialog.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

const mockLine: Line = { id: 'l1', code: 'L1', name: 'Line 1', color: '#F00', type: null, stopCount: 2, itineraryCount: 1 };
const mockStop: Stop = { id: 's1', name: 'Central', latitude: 48.8, longitude: 2.3, lines: [{ code: 'L1', name: 'Line 1', color: '#F00' }], scheduleCount: 3, hasDevice: false };
const mockSchedule: Schedule = {
  id: 'sc1', time: '08:30:00', stopId: 's1',
  itinerary: { id: 'i1', name: 'North', terminusName: 'Terminal', line: { code: 'L1', name: 'Line 1', color: '#F00' } },
};

describe('SchedulesComponent', () => {
  let component: SchedulesComponent;
  let fixture: ComponentFixture<SchedulesComponent>;
  let mockLineService: { getAll: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };
  let mockScheduleService: {
    getForStop: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLineService = { getAll: vi.fn().mockReturnValue(of([mockLine])) };
    mockStopService = { getAll: vi.fn().mockReturnValue(of([mockStop])) };
    mockScheduleService = {
      getForStop: vi.fn().mockReturnValue(of([mockSchedule])),
      create: vi.fn().mockReturnValue(of(mockSchedule)),
      update: vi.fn().mockReturnValue(of(mockSchedule)),
      delete: vi.fn().mockReturnValue(of(void 0)),
    };
    mockDialog = { open: vi.fn() };
    mockSnackBar = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SchedulesComponent],
      providers: [
        provideNoopAnimations(),
        { provide: LineService, useValue: mockLineService },
        { provide: StopService, useValue: mockStopService },
        { provide: ScheduleService, useValue: mockScheduleService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    fixture = TestBed.createComponent(SchedulesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load lines on init', () => {
      fixture.detectChanges();

      expect(mockLineService.getAll).toHaveBeenCalled();
      expect(component.lines()).toEqual([mockLine]);
    });
  });

  describe('onLineChange', () => {
    it('should load stops for the selected line', () => {
      fixture.detectChanges();
      component.selectedLineId = 'l1';

      component.onLineChange();

      expect(mockStopService.getAll).toHaveBeenCalledWith('l1');
      expect(component.stops()).toEqual([mockStop]);
      expect(component.selectedStopId).toBe('');
      expect(component.selectedStop()).toBeNull();
      expect(component.dataSource.data).toEqual([]);
    });

    it('should clear stops when no line is selected', () => {
      fixture.detectChanges();
      component.stops.set([mockStop]);
      component.selectedLineId = '';

      component.onLineChange();

      expect(mockStopService.getAll).not.toHaveBeenCalled();
      expect(component.stops()).toEqual([]);
      expect(component.selectedStopId).toBe('');
      expect(component.selectedStop()).toBeNull();
      expect(component.dataSource.data).toEqual([]);
    });
  });

  describe('loadSchedules', () => {
    it('should load and sort schedules when a stop is selected', () => {
      fixture.detectChanges();
      component.stops.set([mockStop]);
      component.selectedStopId = 's1';
      const laterSchedule: Schedule = {
        id: 'sc2', time: '14:00:00', stopId: 's1',
        itinerary: { id: 'i2', name: 'South', terminusName: 'South End', line: { code: 'L1', name: 'Line 1', color: '#F00' } },
      };
      const earlySchedule: Schedule = {
        id: 'sc3', time: '06:00:00', stopId: 's1',
        itinerary: { id: 'i3', name: 'East', terminusName: 'East End', line: { code: 'L1', name: 'Line 1', color: '#F00' } },
      };
      mockScheduleService.getForStop.mockReturnValue(of([laterSchedule, earlySchedule, mockSchedule]));

      component.loadSchedules();

      expect(component.selectedStop()).toEqual(mockStop);
      expect(mockScheduleService.getForStop).toHaveBeenCalledWith('s1');
      expect(component.dataSource.data[0].time).toBe('06:00:00');
      expect(component.dataSource.data[1].time).toBe('08:30:00');
      expect(component.dataSource.data[2].time).toBe('14:00:00');
      expect(component.loading()).toBe(false);
    });

    it('should clear data when no stop is selected', () => {
      fixture.detectChanges();
      component.selectedStopId = '';
      component.dataSource.data = [mockSchedule];
      component.selectedStop.set(mockStop);

      component.loadSchedules();

      expect(component.selectedStop()).toBeNull();
      expect(component.dataSource.data).toEqual([]);
      expect(mockScheduleService.getForStop).not.toHaveBeenCalled();
    });

    it('should handle error and show snackbar', () => {
      fixture.detectChanges();
      component.stops.set([mockStop]);
      component.selectedStopId = 's1';
      mockScheduleService.getForStop.mockReturnValue(
        throwError(() => ({ error: { message: 'Server error' } })),
      );

      component.loadSchedules();

      expect(component.loading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Server error', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });

    it('should show fallback error message when error has no message', () => {
      fixture.detectChanges();
      component.stops.set([mockStop]);
      component.selectedStopId = 's1';
      mockScheduleService.getForStop.mockReturnValue(throwError(() => ({ error: {} })));

      component.loadSchedules();

      expect(mockSnackBar.open).toHaveBeenCalledWith('Failed to load schedules', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });

  describe('formatTime', () => {
    it('should convert "08:30:00" to "08:30"', () => {
      expect(component.formatTime('08:30:00')).toBe('08:30');
    });

    it('should convert "14:05:30" to "14:05"', () => {
      expect(component.formatTime('14:05:30')).toBe('14:05');
    });
  });

  describe('openCreateDialog', () => {
    it('should return early if no stop is selected', () => {
      fixture.detectChanges();
      component.selectedStop.set(null);

      component.openCreateDialog();

      expect(mockDialog.open).not.toHaveBeenCalled();
    });

    it('should create schedule and reload on dialog success', () => {
      fixture.detectChanges();
      component.selectedStop.set(mockStop);
      component.stops.set([mockStop]);
      component.selectedStopId = 's1';
      const dialogResult = { time: '09:00', itineraryId: 'i1' };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(dialogResult) });

      component.openCreateDialog();

      expect(mockDialog.open).toHaveBeenCalledWith(ScheduleDialogComponent, {
        data: { lines: mockStop.lines },
        width: '450px',
        ariaLabel: 'Create new schedule entry',
      });
      expect(mockScheduleService.create).toHaveBeenCalledWith('s1', dialogResult);
      expect(mockScheduleService.getForStop).toHaveBeenCalledWith('s1');
      expect(mockSnackBar.open).toHaveBeenCalledWith('Schedule entry created', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call create when dialog is cancelled', () => {
      fixture.detectChanges();
      component.selectedStop.set(mockStop);
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openCreateDialog();

      expect(mockScheduleService.create).not.toHaveBeenCalled();
    });
  });

  describe('openEditDialog', () => {
    it('should update schedule and reload on dialog success', () => {
      fixture.detectChanges();
      component.selectedStop.set(mockStop);
      component.stops.set([mockStop]);
      component.selectedStopId = 's1';
      const editResult = { time: '10:00', itineraryId: 'i1' };
      mockDialog.open.mockReturnValue({ afterClosed: () => of(editResult) });

      component.openEditDialog(mockSchedule);

      expect(mockDialog.open).toHaveBeenCalledWith(ScheduleDialogComponent, {
        data: { entry: mockSchedule, lines: mockStop.lines },
        width: '450px',
        ariaLabel: 'Edit schedule entry at 08:30',
      });
      expect(mockScheduleService.update).toHaveBeenCalledWith('sc1', editResult);
      expect(mockScheduleService.getForStop).toHaveBeenCalledWith('s1');
      expect(mockSnackBar.open).toHaveBeenCalledWith('Schedule entry updated', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call update when dialog is cancelled', () => {
      fixture.detectChanges();
      component.selectedStop.set(mockStop);
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

      component.openEditDialog(mockSchedule);

      expect(mockScheduleService.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteSchedule', () => {
    it('should delete and reload when confirmed', () => {
      fixture.detectChanges();
      component.stops.set([mockStop]);
      component.selectedStopId = 's1';
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });

      component.deleteSchedule(mockSchedule);

      expect(mockDialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
        data: {
          title: 'Delete Schedule Entry',
          message: 'Delete schedule entry at 08:30 to Terminal?',
          confirmText: 'Delete',
          confirmColor: 'warn',
        },
        ariaLabel: 'Confirm deletion of schedule entry at 08:30',
      });
      expect(mockScheduleService.delete).toHaveBeenCalledWith('sc1');
      expect(mockScheduleService.getForStop).toHaveBeenCalledWith('s1');
      expect(mockSnackBar.open).toHaveBeenCalledWith('Schedule entry deleted', 'Close', {
        duration: 3000,
        panelClass: 'success-snackbar',
      });
    });

    it('should not call delete when cancelled', () => {
      fixture.detectChanges();
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });

      component.deleteSchedule(mockSchedule);

      expect(mockScheduleService.delete).not.toHaveBeenCalled();
    });
  });
});
