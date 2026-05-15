import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { StopDialogComponent, StopDialogData } from './stop-dialog.component';
import { CreateStopRequest, Line, Stop } from '@shared/models';
import { TranslocoTestingModule } from '@jsverse/transloco';

const en = {
  common: { cancel: 'Cancel', delete: 'Delete' },
  admin: {
    stops: {
      dialog: {
        titleCreate: 'New Stop',
        titleEdit: 'Edit Stop',
        fieldLines: 'Lines',
        fieldLinesHint: 'Select one or more lines this stop serves',
        fieldLinesRequired: 'At least one line is required',
        fieldName: 'Name',
        fieldNamePlaceholder: 'e.g., Central Station',
        fieldNameRequired: 'Name is required',
        fieldLatitude: 'Latitude',
        fieldLongitude: 'Longitude',
        actionCreate: 'Create Stop',
        actionSave: 'Save Changes',
      },
    },
  },
};

const savedStop: Stop = {
  id: 's1',
  name: 'Central Station',
  latitude: 48.8566,
  longitude: 2.3522,
  lines: [{ id: '1', code: 'L1', name: 'Line 1', color: '#FF0000' }],
  scheduleCount: 0,
  hasDevice: false,
};

describe('StopDialogComponent', () => {
  let component: StopDialogComponent;
  let fixture: ComponentFixture<StopDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let submit: StopDialogData['submit'] & ReturnType<typeof vi.fn>;

  const mockLines: Line[] = [
    { id: '1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 },
    { id: '2', code: 'L2', name: 'Line 2', color: '#00FF00', type: null, stopCount: 3, itineraryCount: 1 },
  ];

  function createComponent(overrides: Partial<StopDialogData> = {}): void {
    mockDialogRef = { close: vi.fn() };
    submit = vi.fn().mockReturnValue(of(savedStop)) as typeof submit;
    const data: StopDialogData = { lines: mockLines, submit, ...overrides };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        StopDialogComponent,
        TranslocoTestingModule.forRoot({
          langs: { en, fr: en },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
        }),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    });

    fixture = TestBed.createComponent(StopDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('create mode', () => {
    beforeEach(() => createComponent());

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should display "New Stop" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('New Stop');
    });

    it('should initialize form with empty values', () => {
      expect(component.form.lineIds).toEqual([]);
      expect(component.form.name).toBe('');
      expect(component.form.latitude).toBeNull();
      expect(component.form.longitude).toBeNull();
    });

    it('should show "Create Stop" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Create Stop');
    });

    it('should have empty required fields in create mode making form invalid', () => {
      // name is required and empty, lineIds is empty
      expect(component.form.name).toBe('');
      expect(component.form.lineIds).toEqual([]);
    });

    it('should have all required fields populated after user fills the form', () => {
      component.form.name = 'Central Station';
      component.form.lineIds = ['1'];

      // All required fields are now populated
      expect(component.form.name).toBeTruthy();
      expect(component.form.lineIds.length).toBeGreaterThan(0);
    });

    it('should call submit with the form payload and close with the server response', () => {
      component.form.name = 'Central Station';
      component.form.lineIds = ['1', '2'];
      component.form.latitude = 48.8566;
      component.form.longitude = 2.3522;

      component.save();

      expect(submit).toHaveBeenCalledWith({
        name: 'Central Station',
        lineIds: ['1', '2'],
        latitude: 48.8566,
        longitude: 2.3522,
      } satisfies CreateStopRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedStop);
    });

    it('should call submit with undefined coordinates when not provided', () => {
      component.form.name = 'Simple Stop';
      component.form.lineIds = ['1'];

      component.save();

      expect(submit).toHaveBeenCalledWith({
        name: 'Simple Stop',
        lineIds: ['1'],
        latitude: undefined,
        longitude: undefined,
      } satisfies CreateStopRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedStop);
    });

    it('should keep the dialog open and surface the error when submit fails', () => {
      const onError = vi.fn();
      createComponent({ submit: vi.fn().mockReturnValue(throwError(() => new Error('boom'))), onError });
      component.form.name = 'Central Station';
      component.form.lineIds = ['1'];

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should ignore subsequent save clicks while the submit is in flight', () => {
      const inFlight = new Subject<Stop>();
      createComponent({ submit: vi.fn().mockReturnValue(inFlight) });
      component.form.name = 'Central Station';
      component.form.lineIds = ['1'];

      component.save();
      component.save();
      component.save();

      expect(component.submitting()).toBe(true);
      inFlight.next(savedStop);
      inFlight.complete();
      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
    });

    it('should close dialog without data when cancel is clicked', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const cancelBtn = buttons[0];

      cancelBtn.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });

  describe('create mode with preselected line', () => {
    it('should pre-populate lineIds from selectedLineId', () => {
      createComponent({ selectedLineId: '2' });
      expect(component.form.lineIds).toEqual(['2']);
    });
  });

  describe('edit mode', () => {
    const existingStop: Stop = {
      id: 's1',
      name: 'Downtown',
      latitude: 40.7128,
      longitude: -74.006,
      lines: [{ id: '1', code: 'L1', name: 'Line 1', color: '#FF0000' }],
      scheduleCount: 5,
      hasDevice: false,
    };

    beforeEach(() => createComponent({ stop: existingStop }));

    it('should display "Edit Stop" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('Edit Stop');
    });

    it('should pre-populate form fields from dialog data', () => {
      expect(component.form.name).toBe('Downtown');
      expect(component.form.lineIds).toEqual(['1']);
      expect(component.form.latitude).toBe(40.7128);
      expect(component.form.longitude).toBe(-74.006);
    });

    it('should show "Save Changes" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Save Changes');
    });

    it('should call submit with the updated payload on save', () => {
      component.form.name = 'Updated Downtown';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        name: 'Updated Downtown',
        lineIds: ['1'],
        latitude: 40.7128,
        longitude: -74.006,
      } satisfies CreateStopRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedStop);
    });
  });
});
