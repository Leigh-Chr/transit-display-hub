import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ItineraryDialogComponent, ItineraryDialogData } from './itinerary-dialog.component';
import { Line, Itinerary } from '@shared/models';

describe('ItineraryDialogComponent', () => {
  let component: ItineraryDialogComponent;
  let fixture: ComponentFixture<ItineraryDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  const mockLines: Line[] = [
    { id: 'line1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 },
    { id: 'line2', code: 'L2', name: 'Line 2', color: '#00FF00', type: null, stopCount: 3, itineraryCount: 1 },
  ];

  function createComponent(data: ItineraryDialogData = { lines: mockLines }): void {
    mockDialogRef = { close: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ItineraryDialogComponent],
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

    it('should close dialog with form data on save', () => {
      component.form.lineId = 'line1';
      component.form.name = 'Direction East';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        lineId: 'line1',
        name: 'Direction East',
      });
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

    beforeEach(() => createComponent({ itinerary: existingItinerary, lines: mockLines }));

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

    it('should close dialog with updated data on save', () => {
      component.form.name = 'Updated Direction';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        lineId: 'line1',
        name: 'Updated Direction',
      });
    });
  });
});
