import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testTranslocoModule } from '../../../../test-translations';
import { ScheduleDialogComponent, ScheduleDialogData } from './schedule-dialog.component';
import { ItineraryService } from '@core/api/itinerary.service';
import { CreateScheduleRequest, Schedule, LineInfo, Itinerary } from '@shared/models';

const en = {
  common: { cancel: 'Cancel' },
  admin: {
    schedules: {
      dialog: {
        titleCreate: 'New Schedule Entry',
        titleEdit: 'Edit Schedule Entry',
        fieldItinerary: 'Itinerary',
        fieldItineraryRequired: 'Itinerary is required',
        fieldTime: 'Time',
        fieldTimeRequired: 'Time is required',
        actionCreate: 'Create Entry',
        actionSave: 'Save Changes',
      },
    },
  },
};

const fr = {
  common: { cancel: 'Annuler' },
  admin: {
    schedules: {
      dialog: {
        titleCreate: 'Nouvel horaire',
        titleEdit: "Modifier l'horaire",
        fieldItinerary: 'Itinéraire',
        fieldItineraryRequired: "L'itinéraire est requis",
        fieldTime: 'Heure',
        fieldTimeRequired: "L'heure est requise",
        actionCreate: "Créer l'horaire",
        actionSave: 'Enregistrer',
      },
    },
  },
};

const savedSchedule: Schedule = {
  id: 'sch1',
  time: '08:30',
  stopId: 'stop1',
  itinerary: {
    id: 'it1',
    name: 'Direction East',
    terminusName: 'East Terminal',
    directionId: null,
    line: { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
  },
};

describe('ScheduleDialogComponent', () => {
  let component: ScheduleDialogComponent;
  let fixture: ComponentFixture<ScheduleDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockItineraryService: { getAll: ReturnType<typeof vi.fn> };
  let submit: ScheduleDialogData['submit'] & ReturnType<typeof vi.fn>;

  const mockLines: LineInfo[] = [
    { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
  ];

  const mockItineraries: Itinerary[] = [
    {
      id: 'it1',
      name: 'Direction East',
      terminusName: 'East Terminal',
      directionId: null,
      line: { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
      stops: [],
    },
    {
      id: 'it2',
      name: 'Direction West',
      terminusName: 'West Terminal',
      directionId: null,
      line: { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
      stops: [],
    },
  ];

  function createComponent(overrides: Partial<ScheduleDialogData> = {}): void {
    mockDialogRef = { close: vi.fn() };
    mockItineraryService = { getAll: vi.fn().mockReturnValue(of(mockItineraries)) };
    submit = vi.fn().mockReturnValue(of(savedSchedule)) as typeof submit;
    const data: ScheduleDialogData = { lines: mockLines, submit, ...overrides };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        ScheduleDialogComponent,
        testTranslocoModule(en, fr),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: ItineraryService, useValue: mockItineraryService },
      ],
    });

    fixture = TestBed.createComponent(ScheduleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('create mode', () => {
    beforeEach(() => createComponent());

    it('should display "New Schedule Entry" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('New Schedule Entry');
    });

    it('should initialize form with empty values', () => {
      expect(component.form.time).toBe('');
      expect(component.form.itineraryId).toBe('');
    });

    it('should load itineraries on init', () => {
      expect(mockItineraryService.getAll).toHaveBeenCalled();
      expect(component.itineraries()).toEqual(mockItineraries);
    });

    it('should show "Create Entry" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Create Entry');
    });

    it('should have submit button disabled when form is invalid', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.disabled).toBe(true);
    });

    it('should call submit with the form payload and close with the server response', () => {
      component.form.time = '08:30';
      component.form.itineraryId = 'it1';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        time: '08:30',
        itineraryId: 'it1',
      } satisfies CreateScheduleRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedSchedule);
    });

    it('should keep the dialog open and surface the error when submit fails', () => {
      const onError = vi.fn();
      createComponent({ submit: vi.fn().mockReturnValue(throwError(() => new Error('boom'))), onError });
      component.form.time = '08:30';
      component.form.itineraryId = 'it1';

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should ignore subsequent save clicks while the submit is in flight', () => {
      const inFlight = new Subject<Schedule>();
      createComponent({ submit: vi.fn().mockReturnValue(inFlight) });
      component.form.time = '08:30';
      component.form.itineraryId = 'it1';

      component.save();
      component.save();
      component.save();

      expect(component.submitting()).toBe(true);
      inFlight.next(savedSchedule);
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

    it('should filter itineraries by line id', () => {
      const result = component.getItinerariesForLine('line1');
      expect(result.length).toBe(2);

      const emptyResult = component.getItinerariesForLine('nonexistent');
      expect(emptyResult.length).toBe(0);
    });
  });

  describe('create mode with single itinerary auto-select', () => {
    it('should auto-select the itinerary when only one exists', () => {
      const singleItinerary: Itinerary[] = [mockItineraries[0]!];
      mockDialogRef = { close: vi.fn() };
      mockItineraryService = { getAll: vi.fn().mockReturnValue(of(singleItinerary)) };
      submit = vi.fn().mockReturnValue(of(savedSchedule)) as typeof submit;

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          ScheduleDialogComponent,
          testTranslocoModule(en, fr),
        ],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: { lines: mockLines, submit } },
          { provide: MatDialogRef, useValue: mockDialogRef },
          { provide: ItineraryService, useValue: mockItineraryService },
        ],
      });

      fixture = TestBed.createComponent(ScheduleDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.form.itineraryId).toBe('it1');
    });
  });

  describe('edit mode', () => {
    const existingEntry: Schedule = {
      id: 'sch1',
      time: '14:30',
      stopId: 'stop1',
      itinerary: {
        id: 'it1',
        name: 'Direction East',
        terminusName: 'East Terminal',
      directionId: null,
        line: { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
      },
    };

    beforeEach(() => createComponent({ entry: existingEntry }));

    it('should display "Edit Schedule Entry" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('Edit Schedule Entry');
    });

    it('should pre-populate form fields from dialog data', () => {
      expect(component.form.time).toBe('14:30');
      expect(component.form.itineraryId).toBe('it1');
    });

    it('should show "Save Changes" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Save Changes');
    });

    it('should call submit with the updated payload on save', () => {
      component.form.time = '15:00';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        time: '15:00',
        itineraryId: 'it1',
      } satisfies CreateScheduleRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedSchedule);
    });
  });
});
