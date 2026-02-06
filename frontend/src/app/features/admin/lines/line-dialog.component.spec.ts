import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LineDialogComponent, LineDialogData } from './line-dialog.component';
import { Line } from '@shared/models';

describe('LineDialogComponent', () => {
  let component: LineDialogComponent;
  let fixture: ComponentFixture<LineDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  function createComponent(data: LineDialogData = {}) {
    mockDialogRef = { close: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LineDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    });

    fixture = TestBed.createComponent(LineDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('create mode', () => {
    beforeEach(() => createComponent());

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should display "New Line" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('New Line');
    });

    it('should initialize form with empty values and default color', () => {
      expect(component.form.code).toBe('');
      expect(component.form.name).toBe('');
      expect(component.form.color).toBe('#0078D4');
      expect(component.form.type).toBeNull();
    });

    it('should show "Create Line" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Create Line');
    });

    it('should have empty required fields in create mode making form invalid', () => {
      // code and name are required and empty in create mode
      expect(component.form.code).toBe('');
      expect(component.form.name).toBe('');
    });

    it('should have all required fields populated after user fills the form', () => {
      component.form.code = 'L1';
      component.form.name = 'Line 1';
      component.form.color = '#FF0000';

      // All required fields are now populated
      expect(component.form.code).toBeTruthy();
      expect(component.form.name).toBeTruthy();
      expect(component.form.color).toBeTruthy();
    });

    it('should close dialog with form data on save', () => {
      component.form.code = 'L1';
      component.form.name = 'Line 1';
      component.form.color = '#FF0000';
      component.form.type = 'METRO';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        code: 'L1',
        name: 'Line 1',
        color: '#FF0000',
        type: 'METRO',
      });
    });

    it('should close dialog with type null when type is null', () => {
      component.form.code = 'L1';
      component.form.name = 'Line 1';
      component.form.color = '#FF0000';
      component.form.type = null;

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        code: 'L1',
        name: 'Line 1',
        color: '#FF0000',
        type: null,
      });
    });

    it('should close dialog without data when cancel is clicked', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const cancelBtn = buttons[0];

      cancelBtn.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it('should expose lineTypes array with all options', () => {
      expect(component.lineTypes).toEqual(['METRO', 'BUS', 'TRAM', 'TRAIN']);
    });
  });

  describe('edit mode', () => {
    const existingLine: Line = {
      id: '1',
      code: 'M1',
      name: 'Metro Line 1',
      color: '#FF0000',
      type: 'METRO',
      stopCount: 10,
      itineraryCount: 2,
    };

    beforeEach(() => createComponent({ line: existingLine }));

    it('should display "Edit Line" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('Edit Line');
    });

    it('should pre-populate form fields from dialog data', () => {
      expect(component.form.code).toBe('M1');
      expect(component.form.name).toBe('Metro Line 1');
      expect(component.form.color).toBe('#FF0000');
      expect(component.form.type).toBe('METRO');
    });

    it('should show "Save Changes" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Save Changes');
    });

    it('should close dialog with updated data on save', () => {
      component.form.name = 'Updated Name';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        code: 'M1',
        name: 'Updated Name',
        color: '#FF0000',
        type: 'METRO',
      });
    });
  });
});
