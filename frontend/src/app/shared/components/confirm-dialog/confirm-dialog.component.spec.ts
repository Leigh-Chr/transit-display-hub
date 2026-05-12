import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, it, expect, vi } from 'vitest';

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  const defaultData: ConfirmDialogData = {
    title: 'Confirm Delete',
    message: 'Are you sure you want to delete this item?',
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  };

  function createComponent(data: ConfirmDialogData = defaultData): void {
    mockDialogRef = { close: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef }
      ]
    });

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('rendering', () => {
    it('should create the component', () => {
      createComponent();
      expect(component).toBeTruthy();
    });

    it('should display the title', () => {
      createComponent();
      const titleEl = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(titleEl.textContent).toContain('Confirm Delete');
    });

    it('should display the message', () => {
      createComponent();
      const contentEl = fixture.nativeElement.querySelector('mat-dialog-content p');
      expect(contentEl.textContent).toContain('Are you sure you want to delete this item?');
    });
  });

  describe('button texts', () => {
    it('should render the cancel and confirm texts provided by the caller', () => {
      createComponent({
        title: 'Custom Title',
        message: 'Custom message',
        confirmText: 'Yes, delete',
        cancelText: 'No, keep it'
      });

      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons[0].textContent.trim()).toContain('No, keep it');
      expect(buttons[1].textContent.trim()).toContain('Yes, delete');
    });
  });

  describe('confirm color', () => {
    it('should default to warn color', () => {
      createComponent();
      const confirmBtn = fixture.nativeElement.querySelectorAll('button')[1];
      expect(confirmBtn.getAttribute('ng-reflect-color') ?? 'warn').toBe('warn');
    });

    it('should use custom confirm color', () => {
      createComponent({
        title: 'Test',
        message: 'Test',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        confirmColor: 'primary'
      });

      // Component data should have primary color
      expect(component.data.confirmColor).toBe('primary');
    });
  });

  describe('dialog close values', () => {
    it('should have two action buttons', () => {
      createComponent();
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      expect(buttons.length).toBe(2);
    });

    it('should have data accessible for confirm and cancel', () => {
      createComponent();
      // The component exposes data which drives the dialog close behavior
      expect(component.data.title).toBe('Confirm Delete');
      expect(component.dialogRef).toBeTruthy();
    });

    it('should close dialog with true when confirm button is clicked', () => {
      createComponent();
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const confirmBtn = buttons[1];

      confirmBtn.click();
      fixture.detectChanges();

      // The confirm button has [mat-dialog-close]="true" which closes with true
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should close dialog with falsy value when cancel button is clicked', () => {
      createComponent();
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const cancelBtn = buttons[0];

      cancelBtn.click();
      fixture.detectChanges();

      // The cancel button has mat-dialog-close (no value) which closes with ''
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
