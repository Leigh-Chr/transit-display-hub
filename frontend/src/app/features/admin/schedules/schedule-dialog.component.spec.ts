import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ScheduleDialogComponent, ScheduleDialogData } from './schedule-dialog.component';
import { ItineraryService } from '@core/api/itinerary.service';
import { Schedule, LineInfo, Itinerary } from '@shared/models';

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

describe('ScheduleDialogComponent', () => {
  let component: ScheduleDialogComponent;
  let fixture: ComponentFixture<ScheduleDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockItineraryService: { getAll: ReturnType<typeof vi.fn> };

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

  function createComponent(data: ScheduleDialogData = { lines: mockLines }): void {
    mockDialogRef = { close: vi.fn() };
    mockItineraryService = { getAll: vi.fn().mockReturnValue(of(mockItineraries)) };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        ScheduleDialogComponent,
        TranslocoTestingModule.forRoot({
          langs: { en, fr: en },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
        }),
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

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

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

    it('should close dialog with form data on save', () => {
      component.form.time = '08:30';
      component.form.itineraryId = 'it1';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        time: '08:30',
        itineraryId: 'it1',
      });
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

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [
          ScheduleDialogComponent,
          TranslocoTestingModule.forRoot({
            langs: { en, fr: en },
            translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
          }),
        ],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: { lines: mockLines } },
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

    beforeEach(() => createComponent({ entry: existingEntry, lines: mockLines }));

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

    it('should close dialog with updated data on save', () => {
      component.form.time = '15:00';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        time: '15:00',
        itineraryId: 'it1',
      });
    });
  });
});
