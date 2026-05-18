import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { testTranslocoModule } from '../../../../test-translations';
import { ChangePasswordComponent } from './change-password.component';
import { AuthService } from '@core/auth/auth.service';
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

const en = {
  common: { appName: 'Transit Display Hub' },
  auth: {
    login: { logoAlt: 'Transit Display Hub logo' },
    changePassword: {
      title: 'Change your password',
      subtitle: 'Your account requires a new password before continuing.',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Confirm new password',
      submit: 'Update password',
      loadingAriaLabel: 'Updating password',
      mustChangeNotice: 'You must change your password before accessing the app.',
      error: {
        invalidCurrentPassword: 'The current password is incorrect.',
        passwordsDoNotMatch: 'The two passwords do not match.',
        passwordTooShort: 'Password must be at least 12 characters.',
        generic: 'Could not update password. Please try again.',
      },
    },
  },
};

describe('ChangePasswordComponent', () => {
  let component: ChangePasswordComponent;
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let authServiceSpy: {
    changePassword: MockedFunction<AuthService['changePassword']>;
    consumeRedirectUrl: MockedFunction<AuthService['consumeRedirectUrl']>;
  };
  let routerSpy: {
    navigateByUrl: MockedFunction<Router['navigateByUrl']>;
  };

  const VALID_NEW_PASSWORD = 'Brand-New-Str0ng-Pass!';

  beforeEach(async () => {
    authServiceSpy = {
      changePassword: vi.fn(),
      consumeRedirectUrl: vi.fn().mockReturnValue(null),
    };
    routerSpy = { navigateByUrl: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent, testTranslocoModule(en)],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('initial state', () => {
      it('should have empty form fields', () => {
      expect(component.currentPassword).toBe('');
      expect(component.newPassword).toBe('');
      expect(component.confirmPassword).toBe('');
    });

    it('should not be loading', () => {
      expect(component.loading()).toBe(false);
    });

    it('should have no error', () => {
      expect(component.error()).toBeNull();
    });
  });

  describe('form rendering', () => {
    it('renders the three password inputs', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('input[name="currentPassword"]')).not.toBeNull();
      expect(compiled.querySelector('input[name="newPassword"]')).not.toBeNull();
      expect(compiled.querySelector('input[name="confirmPassword"]')).not.toBeNull();
    });

    it('renders the rotation notice', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('You must change your password');
    });

    it('renders the submit button labelled Update password', () => {
      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.textContent).toContain('Update password');
    });
  });

  describe('validation', () => {
    it('does not call the API when fields are empty', () => {
      component.onSubmit();
      expect(authServiceSpy.changePassword).not.toHaveBeenCalled();
    });

    it('surfaces "too short" when the new password is below the minimum length', () => {
      component.currentPassword = 'admin123';
      component.newPassword = 'short';
      component.confirmPassword = 'short';
      component.onSubmit();

      expect(component.error()).toBe('auth.changePassword.error.passwordTooShort');
      expect(authServiceSpy.changePassword).not.toHaveBeenCalled();
    });

    it('surfaces "do not match" when confirmation diverges', () => {
      component.currentPassword = 'admin123';
      component.newPassword = VALID_NEW_PASSWORD;
      component.confirmPassword = VALID_NEW_PASSWORD + 'x';
      component.onSubmit();

      expect(component.error()).toBe('auth.changePassword.error.passwordsDoNotMatch');
      expect(authServiceSpy.changePassword).not.toHaveBeenCalled();
    });
  });

  describe('successful submit', () => {
    beforeEach(() => {
      authServiceSpy.changePassword.mockReturnValue(of(null));
    });

    it('calls authService.changePassword with the credentials', () => {
      component.currentPassword = 'admin123';
      component.newPassword = VALID_NEW_PASSWORD;
      component.confirmPassword = VALID_NEW_PASSWORD;
      component.onSubmit();

      expect(authServiceSpy.changePassword).toHaveBeenCalledWith({
        currentPassword: 'admin123',
        newPassword: VALID_NEW_PASSWORD,
      });
    });

    it('navigates to /admin when no redirect URL is stored', () => {
      component.currentPassword = 'admin123';
      component.newPassword = VALID_NEW_PASSWORD;
      component.confirmPassword = VALID_NEW_PASSWORD;
      component.onSubmit();

      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/admin');
    });

    it('navigates to the stored redirect URL when present', () => {
      authServiceSpy.consumeRedirectUrl.mockReturnValueOnce('/admin/schedules?page=2');
      component.currentPassword = 'admin123';
      component.newPassword = VALID_NEW_PASSWORD;
      component.confirmPassword = VALID_NEW_PASSWORD;
      component.onSubmit();

      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/admin/schedules?page=2');
    });
  });

  describe('error handling', () => {
    it('surfaces invalidCurrentPassword on 401', () => {
      authServiceSpy.changePassword.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 }))
      );
      component.currentPassword = 'wrong';
      component.newPassword = VALID_NEW_PASSWORD;
      component.confirmPassword = VALID_NEW_PASSWORD;
      component.onSubmit();

      expect(component.error()).toBe('auth.changePassword.error.invalidCurrentPassword');
      expect(component.loading()).toBe(false);
    });

    it('surfaces passwordTooShort on 400', () => {
      authServiceSpy.changePassword.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 400 }))
      );
      component.currentPassword = 'admin123';
      component.newPassword = VALID_NEW_PASSWORD;
      component.confirmPassword = VALID_NEW_PASSWORD;
      component.onSubmit();

      expect(component.error()).toBe('auth.changePassword.error.passwordTooShort');
    });

    it('surfaces a generic message on 500', () => {
      authServiceSpy.changePassword.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );
      component.currentPassword = 'admin123';
      component.newPassword = VALID_NEW_PASSWORD;
      component.confirmPassword = VALID_NEW_PASSWORD;
      component.onSubmit();

      expect(component.error()).toBe('auth.changePassword.error.generic');
    });
  });
});
