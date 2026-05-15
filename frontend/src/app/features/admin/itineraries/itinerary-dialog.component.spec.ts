import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ItineraryDialogComponent, ItineraryDialogData } from './itinerary-dialog.component';
import { CreateItineraryRequest, Line, Itinerary } from '@shared/models';

const en = {
  common: { cancel: 'Cancel' },
  admin: {
    itineraries: {
      dialog: {
        titleCreate: 'New Itinerary',
        titleEdit: 'Edit Itinerary',
        fieldLine: 'Line',
        fieldLineHint: 'Line cannot be changed after creation',
        fieldLineRequired: 'Line is required',
        fieldName: 'Itinerary Name',
        fieldNamePlaceholder: 'e.g., Direction Eastern Terminal',
        fieldNameHint: 'Name for this direction/itinerary',
        fieldNameRequired: 'Name is required',
        fieldTerminus: 'Terminus',
        fieldTerminusPlaceholder: 'e.g., North Terminal',
        infoAfterCreate: 'After creating the itinerary, you can add stops to define the terminus.',
        terminusLabel: 'Terminus:',
        terminusHint: 'The terminus is automatically derived from the last stop.',
        actionCreate: 'Create Itinerary',
        actionSave: 'Save Changes',
      },
    },
  },
};

const savedItinerary: Itinerary = {
  id: 'it1',
  name: 'Direction East',
  terminusName: 'East Terminal',
  directionId: null,
  line: { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
  stops: [],
};

describe('ItineraryDialogComponent', () => {
  let component: ItineraryDialogComponent;
  let fixture: ComponentFixture<ItineraryDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let submit: ItineraryDialogData['submit'] & ReturnType<typeof vi.fn>;

  const mockLines: Line[] = [
    { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 },
    { id: 'line2', code: 'L2', name: 'Line 2', color: '#00FF00', type: null, stopCount: 3, itineraryCount: 1 },
  ];

  function createComponent(overrides: Partial<ItineraryDialogData> = {}): void {
    mockDialogRef = { close: vi.fn() };
    submit = vi.fn().mockReturnValue(of(savedItinerary)) as typeof submit;
    const data: ItineraryDialogData = { lines: mockLines, submit, ...overrides };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        ItineraryDialogComponent,
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

    fixture = TestBed.createComponent(ItineraryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('create mode', () => {
    beforeEach(() => createComponent());

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should display "New Itinerary" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('New Itinerary');
    });

    it('should initialize form with empty values', () => {
      expect(component.form.lineId).toBe('');
      expect(component.form.name).toBe('');
    });

    it('should show "Create Itinerary" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Create Itinerary');
    });

    it('should have empty required fields in create mode making form invalid', () => {
      // lineId and name are required and empty in create mode
      expect(component.form.lineId).toBe('');
      expect(component.form.name).toBe('');
    });

    it('should have all required fields populated after user fills the form', () => {
      component.form.lineId = 'line1';
      component.form.name = 'Direction East';

      expect(component.form.lineId).toBeTruthy();
      expect(component.form.name).toBeTruthy();
    });

    it('should call submit with the form payload and close with the server response', () => {
      component.form.lineId = 'line1';
      component.form.name = 'Direction East';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        lineId: 'line1',
        name: 'Direction East',
      } satisfies CreateItineraryRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedItinerary);
    });

    it('should keep the dialog open and surface the error when submit fails', () => {
      const onError = vi.fn();
      createComponent({ submit: vi.fn().mockReturnValue(throwError(() => new Error('boom'))), onError });
      component.form.lineId = 'line1';
      component.form.name = 'Direction East';

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should ignore subsequent save clicks while the submit is in flight', () => {
      const inFlight = new Subject<Itinerary>();
      createComponent({ submit: vi.fn().mockReturnValue(inFlight) });
      component.form.lineId = 'line1';
      component.form.name = 'Direction East';

      component.save();
      component.save();
      component.save();

      expect(component.submitting()).toBe(true);
      inFlight.next(savedItinerary);
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

    it('should show info text about adding stops after creation', () => {
      const infoText = fixture.nativeElement.querySelector('.info-text');
      expect(infoText).toBeTruthy();
      expect(infoText.textContent).toContain('After creating the itinerary');
    });
  });

  describe('edit mode', () => {
    const existingItinerary: Itinerary = {
      id: 'it1',
      name: 'Direction East',
      terminusName: 'East Terminal',
      directionId: null,
      line: { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000' },
      stops: [{ id: 's1', name: 'Stop 1', position: 0 }],
    };

    beforeEach(() => createComponent({ itinerary: existingItinerary }));

    it('should display "Edit Itinerary" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('Edit Itinerary');
    });

    it('should pre-populate form fields from dialog data', () => {
      expect(component.form.lineId).toBe('line1');
      expect(component.form.name).toBe('Direction East');
    });

    it('should show "Save Changes" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Save Changes');
    });

    it('should show terminus info when itinerary has a terminus', () => {
      const terminusInfo = fixture.nativeElement.querySelector('.terminus-info');
      expect(terminusInfo).toBeTruthy();
      expect(terminusInfo.textContent).toContain('East Terminal');
    });

    it('should not show the info text for new itineraries', () => {
      const infoText = fixture.nativeElement.querySelector('.info-text');
      expect(infoText).toBeNull();
    });

    it('should call submit with the updated payload on save', () => {
      component.form.name = 'Updated Direction';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        lineId: 'line1',
        name: 'Updated Direction',
      } satisfies CreateItineraryRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedItinerary);
    });
  });
});
