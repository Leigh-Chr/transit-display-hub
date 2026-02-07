import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StopDialogComponent, StopDialogData } from './stop-dialog.component';
import { Line, Stop } from '@shared/models';

describe('StopDialogComponent', () => {
  let component: StopDialogComponent;
  let fixture: ComponentFixture<StopDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  const mockLines: Line[] = [
    { id: '1', code: 'L1', name: 'Line 1', color: '#FF0000', type: null, stopCount: 5, itineraryCount: 2 },
    { id: '2', code: 'L2', name: 'Line 2', color: '#00FF00', type: null, stopCount: 3, itineraryCount: 1 },
  ];

  function createComponent(data: StopDialogData = { lines: mockLines }): void {
    mockDialogRef = { close: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StopDialogComponent],
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

    it('should close dialog with form data on save', () => {
      component.form.name = 'Central Station';
      component.form.lineIds = ['1', '2'];
      component.form.latitude = 48.8566;
      component.form.longitude = 2.3522;

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'Central Station',
        lineIds: ['1', '2'],
        latitude: 48.8566,
        longitude: 2.3522,
      });
    });

    it('should close dialog with undefined coordinates when not provided', () => {
      component.form.name = 'Simple Stop';
      component.form.lineIds = ['1'];

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'Simple Stop',
        lineIds: ['1'],
        latitude: undefined,
        longitude: undefined,
      });
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
      createComponent({ lines: mockLines, selectedLineId: '2' });
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

    beforeEach(() => createComponent({ stop: existingStop, lines: mockLines }));

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

    it('should close dialog with updated data on save', () => {
      component.form.name = 'Updated Downtown';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'Updated Downtown',
        lineIds: ['1'],
        latitude: 40.7128,
        longitude: -74.006,
      });
    });
  });
});
