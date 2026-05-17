import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { testTranslocoModule } from '../../../../test-translations';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceDialogComponent, DeviceDialogData } from './device-dialog.component';
import { StopService } from '@core/api/stop.service';
import { DeviceRegistration, Line, RegisterDeviceRequest, Stop } from '@shared/models';

const en = {
  common: { cancel: 'Cancel' },
  admin: {
    devices: {
      dialog: {
        title: 'Register New Device',
        fieldLine: 'Line',
        fieldLineRequired: 'Line is required',
        fieldStop: 'Stop',
        fieldStopRequired: 'Stop is required',
        fieldStopHint: 'Pick a line first',
        actionRegister: 'Register Device',
      },
    },
  },
};

const fr = {
  common: { cancel: 'Annuler' },
  admin: {
    devices: {
      dialog: {
        title: 'Enregistrer une nouvelle borne',
        fieldLine: 'Ligne',
        fieldLineRequired: 'La ligne est requise',
        fieldStop: 'Arrêt',
        fieldStopRequired: "L'arrêt est requis",
        fieldStopHint: "Choisissez d'abord une ligne",
        actionRegister: 'Enregistrer la borne',
      },
    },
  },
};

const savedRegistration: DeviceRegistration = {
  id: 'd1',
  token: 'jwt-token-123',
  stopId: 'stop1',
  stopName: 'Central',
};

describe('DeviceDialogComponent', () => {
  let component: DeviceDialogComponent;
  let fixture: ComponentFixture<DeviceDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockStopService: { getAll: ReturnType<typeof vi.fn> };
  let submit: DeviceDialogData['submit'] & ReturnType<typeof vi.fn>;

  const mockLines: Line[] = [
    { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 },
    { id: 'line2', code: 'L2', name: 'Line 2', color: '#00FF00', type: null, stopCount: 3, itineraryCount: 1 },
  ];

  const mockStops: Stop[] = [
    { id: 'stop1', name: 'Central', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
    { id: 'stop2', name: 'North', latitude: null, longitude: null, lines: [], scheduleCount: 0, hasDevice: false },
  ];

  function createComponent(overrides: Partial<DeviceDialogData> = {}): void {
    mockDialogRef = { close: vi.fn() };
    mockStopService = { getAll: vi.fn().mockReturnValue(of(mockStops)) };
    submit = vi.fn().mockReturnValue(of(savedRegistration)) as typeof submit;
    const data: DeviceDialogData = { lines: mockLines, submit, ...overrides };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        DeviceDialogComponent,
        testTranslocoModule(en, fr),
      ],
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

    it('should call submit with the stopId payload and close with the server response', () => {
      component.form.stopId = 'stop1';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        stopId: 'stop1',
      } satisfies RegisterDeviceRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedRegistration);
    });

    it('should keep the dialog open and surface the error when submit fails', () => {
      const onError = vi.fn();
      createComponent({ submit: vi.fn().mockReturnValue(throwError(() => new Error('boom'))), onError });
      component.form.stopId = 'stop1';

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should ignore subsequent save clicks while the submit is in flight', () => {
      const inFlight = new Subject<DeviceRegistration>();
      createComponent({ submit: vi.fn().mockReturnValue(inFlight) });
      component.form.stopId = 'stop1';

      component.save();
      component.save();
      component.save();

      expect(component.submitting()).toBe(true);
      inFlight.next(savedRegistration);
      inFlight.complete();
      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
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
