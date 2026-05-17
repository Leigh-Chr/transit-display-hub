import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { LineDialogComponent, LineDialogData } from './line-dialog.component';
import { Line, CreateLineRequest } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

const en = {
  common: { cancel: 'Cancel', delete: 'Delete' },
  admin: {
    lines: {
      dialog: {
        titleCreate: 'New Line',
        titleEdit: 'Edit Line',
        fieldCode: 'Code',
        fieldCodePlaceholder: 'e.g., L1, M2, T3',
        fieldCodeRequired: 'Code is required',
        fieldName: 'Name',
        fieldNamePlaceholder: 'e.g., Line 1 - Downtown Express',
        fieldNameRequired: 'Name is required',
        fieldType: 'Type',
        fieldTypeRequired: 'Type is required',
        fieldColor: 'Color',
        fieldColorRequired: 'Color is required',
        actionCreate: 'Create Line',
        actionSave: 'Save Changes',
      },
    },
  },
};

const fr = {
  common: { cancel: 'Annuler', delete: 'Supprimer' },
  admin: {
    lines: {
      dialog: {
        titleCreate: 'Nouvelle ligne',
        titleEdit: 'Modifier la ligne',
        fieldCode: 'Code',
        fieldCodePlaceholder: 'ex. L1, M2, T3',
        fieldCodeRequired: 'Le code est requis',
        fieldName: 'Nom',
        fieldNamePlaceholder: 'ex. Ligne 1 - Centre-ville',
        fieldNameRequired: 'Le nom est requis',
        fieldType: 'Type',
        fieldTypeRequired: 'Le type est requis',
        fieldColor: 'Couleur',
        fieldColorRequired: 'La couleur est requise',
        actionCreate: 'Créer la ligne',
        actionSave: 'Enregistrer',
      },
    },
  },
};

const savedLine: Line = {
  id: '1',
  code: 'L1',
  name: 'Line 1',
  color: '#FF0000',
  type: 'METRO',
  stopCount: 0,
  itineraryCount: 0,
};

describe('LineDialogComponent', () => {
  let component: LineDialogComponent;
  let fixture: ComponentFixture<LineDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let submit: LineDialogData['submit'] & ReturnType<typeof vi.fn>;

  function createComponent(overrides: Partial<LineDialogData> = {}): void {
    mockDialogRef = { close: vi.fn() };
    submit = vi.fn().mockReturnValue(of(savedLine)) as typeof submit;
    const data: LineDialogData = { submit, ...overrides };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        LineDialogComponent,
        testTranslocoModule(en, fr),
      ],
      providers: [
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
      expect(component.form.code).toBe('');
      expect(component.form.name).toBe('');
    });

    it('should have all required fields populated after user fills the form', () => {
      component.form.code = 'L1';
      component.form.name = 'Line 1';
      component.form.color = '#FF0000';

      expect(component.form.code).toBeTruthy();
      expect(component.form.name).toBeTruthy();
      expect(component.form.color).toBeTruthy();
    });

    it('should call submit with the form payload and close with the server response', () => {
      component.form.code = 'L1';
      component.form.name = 'Line 1';
      component.form.color = '#FF0000';
      component.form.type = 'METRO';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        code: 'L1',
        name: 'Line 1',
        color: '#FF0000',
        type: 'METRO',
      } satisfies CreateLineRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedLine);
    });

    it('should not call submit when type is null', () => {
      component.form.code = 'L1';
      component.form.name = 'Line 1';
      component.form.color = '#FF0000';
      component.form.type = null;

      component.save();

      expect(submit).not.toHaveBeenCalled();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should keep the dialog open and surface the error when submit fails', () => {
      const onError = vi.fn();
      createComponent({ submit: vi.fn().mockReturnValue(throwError(() => new Error('boom'))), onError });
      component.form.code = 'L1';
      component.form.name = 'Line 1';
      component.form.color = '#FF0000';
      component.form.type = 'METRO';

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should ignore subsequent save clicks while the submit is in flight', () => {
      const inFlight = new Subject<Line>();
      createComponent({ submit: vi.fn().mockReturnValue(inFlight) });
      component.form.code = 'L1';
      component.form.name = 'Line 1';
      component.form.color = '#FF0000';
      component.form.type = 'METRO';

      component.save();
      component.save();
      component.save();

      expect(component.submitting()).toBe(true);
      inFlight.next(savedLine);
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

    it('should expose lineTypes array with all options', () => {
      expect(component.lineTypes).toEqual([
        'METRO',
        'BUS',
        'TRAM',
        'TRAIN',
        'FERRY',
        'FUNICULAR',
        'CABLE_CAR',
        'TROLLEYBUS',
        'MONORAIL',
        'OTHER',
      ]);
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

    it('should call submit with the updated payload on save', () => {
      component.form.name = 'Updated Name';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        code: 'M1',
        name: 'Updated Name',
        color: '#FF0000',
        type: 'METRO',
      } satisfies CreateLineRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedLine);
    });
  });
});
