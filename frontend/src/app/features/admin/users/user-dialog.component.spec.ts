import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { testTranslocoModule } from '../../../../test-translations';
import { of, Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserDialogComponent, UserDialogData } from './user-dialog.component';
import { CreateUserRequest, UpdateUserRequest, User } from '@shared/models';

const en = {
  common: { cancel: 'Cancel' },
  admin: {
    users: {
      dialog: {
        titleCreate: 'New User',
        titleEdit: 'Edit User',
        fieldUsername: 'Username',
        fieldUsernamePlaceholder: 'Enter username',
        fieldUsernameHint: '3-50 characters',
        fieldUsernameRequired: 'Username must be 3-50 characters',
        fieldPassword: 'Password',
        fieldPasswordPlaceholderCreate: 'Enter password',
        fieldPasswordPlaceholderEdit: 'Leave empty to keep current',
        fieldPasswordHintCreate: 'Minimum 6 characters',
        fieldPasswordHintEdit: 'Leave empty to keep current password',
        fieldPasswordErrorCreate: 'Password is required (min 6 characters)',
        fieldPasswordErrorEdit: 'Password must be at least 6 characters',
        fieldRole: 'Role',
        fieldRoleRequired: 'Role is required',
        roleAdminDesc: 'Full access to all features',
        roleAgentDesc: 'Can only manage messages',
        fieldEnabled: 'Account enabled',
        fieldEnabledHint: 'Disabled accounts cannot log in',
        actionCreate: 'Create User',
        actionSave: 'Save Changes',
      },
    },
  },
};

const fr = {
  common: { cancel: 'Annuler' },
  admin: {
    users: {
      dialog: {
        titleCreate: 'Nouvel utilisateur',
        titleEdit: "Modifier l'utilisateur",
        fieldUsername: "Nom d'utilisateur",
        fieldUsernamePlaceholder: "Saisissez le nom d'utilisateur",
        fieldUsernameHint: 'Entre 3 et 50 caractères',
        fieldUsernameRequired: "Le nom d'utilisateur doit comporter entre 3 et 50 caractères",
        fieldPassword: 'Mot de passe',
        fieldPasswordPlaceholderCreate: 'Saisissez le mot de passe',
        fieldPasswordPlaceholderEdit: 'Laisser vide pour conserver le mot de passe actuel',
        fieldPasswordHintCreate: 'Au minimum 6 caractères',
        fieldPasswordHintEdit: 'Laisser vide pour conserver le mot de passe actuel',
        fieldPasswordErrorCreate: 'Le mot de passe est requis (min. 6 caractères)',
        fieldPasswordErrorEdit: 'Le mot de passe doit comporter au moins 6 caractères',
        fieldRole: 'Rôle',
        fieldRoleRequired: 'Le rôle est requis',
        roleAdminDesc: 'Accès complet à toutes les fonctionnalités',
        roleAgentDesc: 'Peut uniquement gérer les messages',
        fieldEnabled: 'Compte activé',
        fieldEnabledHint: 'Les comptes désactivés ne peuvent pas se connecter',
        actionCreate: "Créer l'utilisateur",
        actionSave: 'Enregistrer',
      },
    },
  },
};

const savedUser: User = {
  id: 'u1',
  username: 'newuser',
  role: 'AGENT',
  enabled: true,
};

describe('UserDialogComponent', () => {
  let component: UserDialogComponent;
  let fixture: ComponentFixture<UserDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let submit: UserDialogData['submit'] & ReturnType<typeof vi.fn>;

  function createComponent(overrides: Partial<UserDialogData> = {}): void {
    mockDialogRef = { close: vi.fn() };
    submit = vi.fn().mockReturnValue(of(savedUser)) as typeof submit;
    const data: UserDialogData = { isEdit: false, submit, ...overrides };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        UserDialogComponent,
        testTranslocoModule(en, fr),
      ],
      providers: [
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

    it('should call submit with a CreateUserRequest payload and close with the server response', () => {
      component.form.username = 'newuser';
      component.form.password = 'password123';
      component.form.role = 'AGENT';

      component.save();

      expect(submit).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'password123',
        role: 'AGENT',
      } satisfies CreateUserRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedUser);
    });

    it('should keep the dialog open and surface the error when submit fails', () => {
      const onError = vi.fn();
      createComponent({ submit: vi.fn().mockReturnValue(throwError(() => new Error('boom'))), onError });
      component.form.username = 'newuser';
      component.form.password = 'password123';
      component.form.role = 'AGENT';

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(component.submitting()).toBe(false);
    });

    it('should ignore subsequent save clicks while the submit is in flight', () => {
      const inFlight = new Subject<User>();
      createComponent({ submit: vi.fn().mockReturnValue(inFlight) });
      component.form.username = 'newuser';
      component.form.password = 'password123';
      component.form.role = 'AGENT';

      component.save();
      component.save();
      component.save();

      expect(component.submitting()).toBe(true);
      inFlight.next(savedUser);
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

    it('should call submit with an UpdateUserRequest payload on save', () => {
      component.form.role = 'AGENT';
      component.form.enabled = false;

      component.save();

      expect(submit).toHaveBeenCalledWith({
        password: undefined,
        role: 'AGENT',
        enabled: false,
      } satisfies UpdateUserRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedUser);
    });

    it('should include password in UpdateUserRequest when provided', () => {
      component.form.password = 'newpassword123';
      component.form.role = 'ADMIN';
      component.form.enabled = true;

      component.save();

      expect(submit).toHaveBeenCalledWith({
        password: 'newpassword123',
        role: 'ADMIN',
        enabled: true,
      } satisfies UpdateUserRequest);
      expect(mockDialogRef.close).toHaveBeenCalledWith(savedUser);
    });
  });
});
