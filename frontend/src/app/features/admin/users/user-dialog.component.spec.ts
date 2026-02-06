import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserDialogComponent, UserDialogData } from './user-dialog.component';
import { User } from '@shared/models';

describe('UserDialogComponent', () => {
  let component: UserDialogComponent;
  let fixture: ComponentFixture<UserDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  function createComponent(data: UserDialogData = { isEdit: false }) {
    mockDialogRef = { close: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [UserDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    });

    fixture = TestBed.createComponent(UserDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('create mode', () => {
    beforeEach(() => createComponent({ isEdit: false }));

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should display "New User" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('New User');
    });

    it('should initialize form with default values', () => {
      expect(component.form.username).toBe('');
      expect(component.form.password).toBe('');
      expect(component.form.role).toBe('AGENT');
      expect(component.form.enabled).toBe(true);
    });

    it('should show "Create User" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Create User');
    });

    it('should report form invalid when fields are empty', () => {
      expect(component.isFormValid()).toBe(false);
    });

    it('should report form invalid when username is too short', () => {
      component.form.username = 'ab';
      component.form.password = 'password123';
      component.form.role = 'ADMIN';

      expect(component.isFormValid()).toBe(false);
    });

    it('should report form invalid when password is too short', () => {
      component.form.username = 'validuser';
      component.form.password = '12345';
      component.form.role = 'ADMIN';

      expect(component.isFormValid()).toBe(false);
    });

    it('should report form valid when all fields meet requirements', () => {
      component.form.username = 'newuser';
      component.form.password = 'password123';
      component.form.role = 'ADMIN';

      expect(component.isFormValid()).toBe(true);
    });

    it('should close dialog with CreateUserRequest on save', () => {
      component.form.username = 'newuser';
      component.form.password = 'password123';
      component.form.role = 'AGENT';

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'password123',
        role: 'AGENT',
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

  describe('edit mode', () => {
    const existingUser: User = {
      id: 'u1',
      username: 'existinguser',
      role: 'ADMIN',
      enabled: true,
    };

    beforeEach(() => createComponent({ isEdit: true, user: existingUser }));

    it('should display "Edit User" title', () => {
      const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
      expect(title.textContent).toContain('Edit User');
    });

    it('should pre-populate form fields from dialog data', () => {
      expect(component.form.username).toBe('existinguser');
      expect(component.form.password).toBe('');
      expect(component.form.role).toBe('ADMIN');
      expect(component.form.enabled).toBe(true);
    });

    it('should show "Save Changes" on submit button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('mat-dialog-actions button');
      const submitBtn = buttons[1];
      expect(submitBtn.textContent).toContain('Save Changes');
    });

    it('should report form valid in edit mode with just a role selected', () => {
      expect(component.isFormValid()).toBe(true);
    });

    it('should report form valid in edit mode even without password', () => {
      component.form.password = '';
      expect(component.isFormValid()).toBe(true);
    });

    it('should close dialog with UpdateUserRequest on save', () => {
      component.form.role = 'AGENT';
      component.form.enabled = false;

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        password: undefined,
        role: 'AGENT',
        enabled: false,
      });
    });

    it('should include password in UpdateUserRequest when provided', () => {
      component.form.password = 'newpassword123';
      component.form.role = 'ADMIN';
      component.form.enabled = true;

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        password: 'newpassword123',
        role: 'ADMIN',
        enabled: true,
      });
    });
  });
});
