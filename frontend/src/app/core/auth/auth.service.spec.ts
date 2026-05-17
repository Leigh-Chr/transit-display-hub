import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthUser, LoginRequest, LoginResponse } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: { navigate: MockedFunction<Router['navigate']> };

  const adminUser: AuthUser = { username: 'admin', role: 'ADMIN' };
  const agentUser: AuthUser = { username: 'agent', role: 'AGENT' };
  const sampleLogin: LoginResponse = {
    token: 'access.jwt.token',
    expiresAt: '2026-05-12T00:00:00Z',
    role: 'ADMIN',
    username: 'admin',
    passwordMustChange: false
  };

  beforeEach(() => {
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        { provide: Router, useValue: router }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initializeSession', () => {
    it('hydrates userSignal from /api/auth/me and quietly refreshes the JWT', async () => {
      const promise = service.initializeSession();
      const me = httpMock.expectOne('/api/auth/me');
      expect(me.request.method).toBe('GET');
      expect(me.request.withCredentials).toBe(true);
      me.flush(adminUser);

      await promise;

      const refresh = httpMock.expectOne('/api/auth/refresh');
      expect(refresh.request.method).toBe('POST');
      refresh.flush(sampleLogin);

      expect(service.currentUser()).toEqual(adminUser);
      expect(service.getToken()).toBe(sampleLogin.token);
    });

    it('leaves the app anonymous when /me returns 401', async () => {
      const promise = service.initializeSession();
      const me = httpMock.expectOne('/api/auth/me');
      me.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      await promise;

      expect(service.currentUser()).toBeNull();
      expect(service.getToken()).toBeNull();
      httpMock.expectNone('/api/auth/refresh');
    });

    it('keeps the user identity even if the background /refresh fails', async () => {
      const promise = service.initializeSession();
      httpMock.expectOne('/api/auth/me').flush(adminUser);
      await promise;

      const refresh = httpMock.expectOne('/api/auth/refresh');
      refresh.flush({ message: 'gone' }, { status: 401, statusText: 'Unauthorized' });

      expect(service.currentUser()).toEqual(adminUser);
      expect(service.getToken()).toBeNull();
    });
  });

  describe('login', () => {
    it('sends credentials with withCredentials and stores user + token in signals', () => {
      const request: LoginRequest = { username: 'admin', password: 'admin123' };

      service.login(request).subscribe(res => {
        expect(res.token).toBe(sampleLogin.token);
        expect(service.currentUser()).toEqual(adminUser);
        expect(service.getToken()).toBe(sampleLogin.token);
        expect(service.isAuthenticated()).toBe(true);
        expect(service.isAdmin()).toBe(true);
      });

      const req = httpMock.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual(request);
      req.flush(sampleLogin);
    });

    it('propagates HTTP errors and leaves state untouched', () => {
      const request: LoginRequest = { username: 'admin', password: 'wrong' };

      service.login(request).subscribe({
        error: (err) => {
          expect(err.status).toBe(401);
          expect(service.currentUser()).toBeNull();
          expect(service.getToken()).toBeNull();
        }
      });

      httpMock.expectOne('/api/auth/login')
        .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('refresh', () => {
    it('rotates the cookie and updates signals on success', () => {
      service.refresh().subscribe();

      const req = httpMock.expectOne('/api/auth/refresh');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush(sampleLogin);

      expect(service.currentUser()).toEqual(adminUser);
      expect(service.getToken()).toBe(sampleLogin.token);
    });
  });

  describe('logout', () => {
    it('clears local state, fires the logout subject, and navigates to /login', () => {
      // Seed an authenticated state.
      service.login({ username: 'admin', password: 'admin123' }).subscribe();
      httpMock.expectOne('/api/auth/login').flush(sampleLogin);
      expect(service.isAuthenticated()).toBe(true);

      let logoutSeen = false;
      service.logout$.subscribe(() => { logoutSeen = true; });

      service.logout();

      httpMock.expectOne('/api/auth/logout').flush(null);
      expect(service.currentUser()).toBeNull();
      expect(service.getToken()).toBeNull();
      expect(logoutSeen).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('clears local state even if the server logout call fails', () => {
      service.login({ username: 'admin', password: 'admin123' }).subscribe();
      httpMock.expectOne('/api/auth/login').flush(sampleLogin);

      service.logout();

      httpMock.expectOne('/api/auth/logout')
        .flush({ message: 'gone' }, { status: 500, statusText: 'Server Error' });
      expect(service.currentUser()).toBeNull();
      expect(service.getToken()).toBeNull();
    });
  });

  describe('signals', () => {
    it('isAuthenticated, currentUser and isAdmin are false/null when anonymous', () => {
      expect(service.isAuthenticated()).toBe(false);
      expect(service.currentUser()).toBeNull();
      expect(service.isAdmin()).toBe(false);
    });

    it('isAdmin is false for an AGENT login', () => {
      const agentLogin: LoginResponse = { ...sampleLogin, role: 'AGENT', username: 'agent' };

      service.login({ username: 'agent', password: 'agent123' }).subscribe();
      httpMock.expectOne('/api/auth/login').flush(agentLogin);

      expect(service.isAdmin()).toBe(false);
      expect(service.currentUser()).toEqual(agentUser);
    });
  });

  describe('redirect URL', () => {
    it('is single-shot: consumeRedirectUrl returns the value once then null', () => {
      service.setRedirectUrl('/admin/lines');
      expect(service.consumeRedirectUrl()).toBe('/admin/lines');
      expect(service.consumeRedirectUrl()).toBeNull();
    });

    it('returns null when no redirect was stashed', () => {
      expect(service.consumeRedirectUrl()).toBeNull();
    });
  });

  describe('getRole', () => {
    it('returns the current role when authenticated', () => {
      service.login({ username: 'admin', password: 'admin123' }).subscribe();
      httpMock.expectOne('/api/auth/login').flush(sampleLogin);
      expect(service.getRole()).toBe('ADMIN');
    });

    it('returns null when anonymous', () => {
      expect(service.getRole()).toBeNull();
    });
  });

  describe('passwordMustChange', () => {
    it('is false by default', () => {
      expect(service.passwordMustChange()).toBe(false);
    });

    it('mirrors the flag returned by /api/auth/login', () => {
      service.login({ username: 'admin', password: 'admin123' }).subscribe();
      httpMock.expectOne('/api/auth/login').flush({ ...sampleLogin, passwordMustChange: true });
      expect(service.passwordMustChange()).toBe(true);
    });

    it('clears after a successful changePassword call', () => {
      service.login({ username: 'admin', password: 'admin123' }).subscribe();
      httpMock.expectOne('/api/auth/login').flush({ ...sampleLogin, passwordMustChange: true });
      expect(service.passwordMustChange()).toBe(true);

      service.changePassword({ currentPassword: 'old', newPassword: 'a-new-strong-password' }).subscribe();
      const req = httpMock.expectOne('/api/auth/change-password');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      req.flush(null);

      expect(service.passwordMustChange()).toBe(false);
    });

    it('resets on logout', () => {
      service.login({ username: 'admin', password: 'admin123' }).subscribe();
      httpMock.expectOne('/api/auth/login').flush({ ...sampleLogin, passwordMustChange: true });

      service.logout();
      httpMock.expectOne('/api/auth/logout').flush(null);

      expect(service.passwordMustChange()).toBe(false);
    });
  });
});
