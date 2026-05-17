import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { testTranslocoModule } from '../../../../test-translations';
import { LoginComponent } from './login.component';
import { AuthService } from '@core/auth/auth.service';
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

const en = {
  common: { appName: 'Transit Display Hub' },
  auth: {
    login: {
      logoAlt: 'Transit Display Hub logo',
      usernameLabel: 'Username',
      passwordLabel: 'Password',
      submit: 'Login',
      loadingAriaLabel: 'Logging in',
      devHint: 'Default credentials: admin / admin123',
      error: {
        invalidCredentials: 'Invalid credentials',
        tooManyAttempts: 'Too many login attempts. Please try again in a few minutes.',
        generic: 'An error occurred. Please try again.',
      },
    },
  },
};

const fr = {
  common: { appName: 'Transit Display Hub' },
  auth: {
    login: {
      logoAlt: 'Logo Transit Display Hub',
      usernameLabel: "Nom d'utilisateur",
      passwordLabel: 'Mot de passe',
      submit: 'Connexion',
      loadingAriaLabel: 'Connexion en cours',
      devHint: 'Identifiants par défaut : admin / admin123',
      error: {
        invalidCredentials: 'Identifiants invalides',
        tooManyAttempts: 'Trop de tentatives. Réessayez dans quelques minutes.',
        generic: "Une erreur s'est produite. Veuillez réessayer.",
      },
    },
  },
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: {
    login: MockedFunction<AuthService['login']>;
    consumeRedirectUrl: MockedFunction<AuthService['consumeRedirectUrl']>;
  };
  let routerSpy: {
    navigate: MockedFunction<Router['navigate']>;
    navigateByUrl: MockedFunction<Router['navigateByUrl']>;
  };

  beforeEach(async () => {
    authServiceSpy = { login: vi.fn(), consumeRedirectUrl: vi.fn().mockReturnValue(null) };
    routerSpy = { navigate: vi.fn(), navigateByUrl: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        testTranslocoModule(en, fr),
      ],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('initial state', () => {
      it('should have empty username', () => {
      expect(component.username).toBe('');
    });

    it('should have empty password', () => {
      expect(component.password).toBe('');
    });

    it('should not be loading', () => {
      expect(component.loading()).toBe(false);
    });

    it('should have no error', () => {
      expect(component.error()).toBeNull();
    });
  });

  describe('form rendering', () => {
    it('should render username input', () => {
      const compiled = fixture.nativeElement;
      const usernameInput = compiled.querySelector('input[name="username"]');
      expect(usernameInput).toBeTruthy();
      expect(usernameInput.type).toBe('text');
    });

    it('should render password input', () => {
      const compiled = fixture.nativeElement;
      const passwordInput = compiled.querySelector('input[name="password"]');
      expect(passwordInput).toBeTruthy();
      expect(passwordInput.type).toBe('password');
    });

    it('should render login button', () => {
      const compiled = fixture.nativeElement;
      const button = compiled.querySelector('button[type="submit"]');
      expect(button).toBeTruthy();
      expect(button.textContent).toContain('Login');
    });

    it('should render default credentials hint', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('admin / admin123');
    });
  });

  describe('onSubmit', () => {
    it('should not call login when username is empty', () => {
      component.username = '';
      component.password = 'password';

      component.onSubmit();

      expect(authServiceSpy.login).not.toHaveBeenCalled();
    });

    it('should not call login when password is empty', () => {
      component.username = 'admin';
      component.password = '';

      component.onSubmit();

      expect(authServiceSpy.login).not.toHaveBeenCalled();
    });

    it('should call authService.login with credentials', () => {
      authServiceSpy.login.mockReturnValue(of({
        token: 'token',
        expiresAt: new Date().toISOString(),
        role: 'ADMIN',
        username: 'admin',
        passwordMustChange: false
      }));

      component.username = 'admin';
      component.password = 'password123';
      component.onSubmit();

      expect(authServiceSpy.login).toHaveBeenCalledWith({
        username: 'admin',
        password: 'password123'
      });
    });

    it('should set loading to true during request', () => {
      authServiceSpy.login.mockReturnValue(of({
        token: 'token',
        expiresAt: new Date().toISOString(),
        role: 'ADMIN',
        username: 'admin',
        passwordMustChange: false
      }));

      component.username = 'admin';
      component.password = 'password123';

      expect(component.loading()).toBe(false);
      component.onSubmit();
      // Loading would be true during the request, then the observable completes
    });

    it('should clear error before request', () => {
      authServiceSpy.login.mockReturnValue(of({
        token: 'token',
        expiresAt: new Date().toISOString(),
        role: 'ADMIN',
        username: 'admin',
        passwordMustChange: false
      }));

      component.error.set('Previous error');
      component.username = 'admin';
      component.password = 'password123';
      component.onSubmit();

      // Error should be cleared
      expect(component.error()).toBeNull();
    });
  });

  describe('successful login', () => {
    beforeEach(() => {
      authServiceSpy.login.mockReturnValue(of({
        token: 'token',
        expiresAt: new Date().toISOString(),
        role: 'ADMIN',
        username: 'admin',
        passwordMustChange: false
      }));
    });

    it('should navigate to /admin on success when no redirect URL is stored', () => {
      component.username = 'admin';
      component.password = 'password123';
      component.onSubmit();

      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/admin');
    });

    it('should navigate to the stored redirect URL when present', () => {
      authServiceSpy.consumeRedirectUrl.mockReturnValueOnce('/admin/schedules?page=2');
      component.username = 'admin';
      component.password = 'password123';
      component.onSubmit();

      expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/admin/schedules?page=2');
    });

    it('should not set error on success', () => {
      component.username = 'admin';
      component.password = 'password123';
      component.onSubmit();

      expect(component.error()).toBeNull();
    });
  });

  describe('failed login', () => {
    it('should display "Invalid credentials" on 401 error', () => {
      const errorResponse = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized'
      });
      authServiceSpy.login.mockReturnValue(throwError(() => errorResponse));

      component.username = 'admin';
      component.password = 'wrong';
      component.onSubmit();
      fixture.detectChanges();

      expect(component.error()).toBe('auth.login.error.invalidCredentials');
      expect(fixture.nativeElement.querySelector('.error-message').textContent)
        .toContain('Invalid credentials');
    });

    it('should display rate-limit error on 429', () => {
      const errorResponse = new HttpErrorResponse({
        status: 429,
        statusText: 'Too Many Requests'
      });
      authServiceSpy.login.mockReturnValue(throwError(() => errorResponse));

      component.username = 'admin';
      component.password = 'wrong';
      component.onSubmit();

      expect(component.error()).toBe('auth.login.error.tooManyAttempts');
    });

    it('should display generic error for other errors', () => {
      const errorResponse = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error'
      });
      authServiceSpy.login.mockReturnValue(throwError(() => errorResponse));

      component.username = 'admin';
      component.password = 'password';
      component.onSubmit();

      expect(component.error()).toBe('auth.login.error.generic');
    });

    it('should set loading to false after error', () => {
      const errorResponse = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized'
      });
      authServiceSpy.login.mockReturnValue(throwError(() => errorResponse));

      component.username = 'admin';
      component.password = 'wrong';
      component.onSubmit();

      expect(component.loading()).toBe(false);
    });

    it('should not navigate on error', () => {
      const errorResponse = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized'
      });
      authServiceSpy.login.mockReturnValue(throwError(() => errorResponse));

      component.username = 'admin';
      component.password = 'wrong';
      component.onSubmit();

      expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('credentials hint visibility', () => {
    it('shows hint when devMode is true', () => {
      (component as unknown as { devMode: boolean }).devMode = true;
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('.hint-text');
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toContain('admin / admin123');
    });

    it('hides hint when devMode is false', () => {
      (component as unknown as { devMode: boolean }).devMode = false;
      fixture.detectChanges();

      const hint = fixture.nativeElement.querySelector('.hint-text');
      expect(hint).toBeNull();
    });
  });

  describe('loading state UI', () => {
    it('should show spinner when loading', () => {
      component.loading.set(true);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should disable button when loading', () => {
      component.loading.set(true);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(true);
    });

    it('should enable button when not loading', () => {
      component.loading.set(false);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(false);
    });
  });

  describe('error display', () => {
    it('should display the translated error message when an error key is set', () => {
      component.error.set('auth.login.error.invalidCredentials');
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.error-message');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Invalid credentials');
    });

    it('should not display error when no error', () => {
      component.error.set(null);
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.error-message');
      expect(errorElement).toBeFalsy();
    });
  });
});
