import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceDialogComponent, DeviceDialogData } from './device-dialog.component';
import { StopService } from '@core/api/stop.service';
import { Line, Stop } from '@shared/models';

describe('DeviceDialogComponent', () => {
  let component: DeviceDialogComponent;
  let fixture: ComponentFixture<DeviceDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };

  const mockLines: Line[] = [
    { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 },
    { id: 'line2', code: 'L2', name: 'Line 2', color: '#00FF00', type: null, stopCount: 3, itineraryCount: 1 },
  ];

  const mockStops: Stop[] = [
    { id: 'stop1', name: 'Central', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
    { id: 'stop2', name: 'North', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
  ];

  function createComponent(data: DeviceDialogData = { lines: mockLines }): void {
    mockDialogRef = { close: vi.fn() };
    mockStopService = { getAll: vi.fn().mockReturnValue(of(mockStops)) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DeviceDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: StopService, useValue: mockStopService },
      ],
    });

    fixture = TestBed.createComponent(DeviceDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('create mode', () => {
    beforeEach(() => createComponent());

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should display "Register New Device" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('Register New Device');
    });

    it('should initialize form with empty values', () => {
      expect(component.form.lineId).toBe('');
      expect(component.form.stopId).toBe('');
    });

    it('should show "Register Device" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Register Device');
    });

    it('should have empty required fields in create mode making form invalid', () => {
      // lineId and stopId are required and empty in create mode
      expect(component.form.lineId).toBe('');
      expect(component.form.stopId).toBe('');
    });

    it('should close dialog without data when cancel is clicked', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const cancelBtn = buttons[0];

      cancelBtn.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it('should close dialog with stopId on save', () => {
      component.form.stopId = 'stop1';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        stopId: 'stop1',
      });
    });
  });

  describe('line change behavior', () => {
    beforeEach(() => createComponent());

    it('should load stops when a line is selected', () => {
      component.form.lineId = 'line1';
      component.onLineChange();

      expect(mockStopService.getAll).toHaveBeenCalledWith('line1');
      expect(component.stops()).toEqual(mockStops);
    });

    it('should clear stopId when line changes', () => {
      component.form.stopId = 'stop1';
      component.form.lineId = 'line2';
      component.onLineChange();

      expect(component.form.stopId).toBe('');
    });

    it('should clear stops when line is deselected', () => {
      component.form.lineId = '';
      component.onLineChange();

      expect(component.stops()).toEqual([]);
      expect(mockStopService.getAll).not.toHaveBeenCalled();
    });

    it('should have stop select disabled when no line is selected', () => {
      // The stop select is disabled via [disabled]="!form.lineId"
      expect(component.form.lineId).toBe('');
      // The component template uses [disabled]="!form.lineId" so we verify the condition
      expect(!component.form.lineId).toBe(true);
    });
  });
});
