import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { LoginResponse } from '@shared/models';
import { NotifyService } from '@core/services/notify.service';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: {
    refresh: MockedFunction<AuthService['refresh']>;
    logout: MockedFunction<AuthService['logout']>;
    setRedirectUrl: MockedFunction<AuthService['setRedirectUrl']>;
  };
  let notifySpy: { error: MockedFunction<NotifyService['error']> };
  let routerSpy: { url: string };

  const protectedUrl = '/api/lines';
  const loginUrl = '/api/auth/login';
  const refreshUrl = '/api/auth/refresh';

  const refreshedSession: LoginResponse = {
    token: 'new.jwt.token',
    expiresAt: '2026-05-12T00:00:00Z',
    role: 'ADMIN',
    username: 'admin',
    passwordMustChange: false
  };

  beforeEach(() => {
    authServiceSpy = {
      refresh: vi.fn(),
      logout: vi.fn(),
      setRedirectUrl: vi.fn()
    };
    notifySpy = { error: vi.fn() };
    routerSpy = { url: '/admin/lines' };

    const translations: Record<string, string> = {
      'common.errors.network': 'Network error: please check your connection',
      'common.errors.accessDenied': 'Access denied: insufficient permissions',
    };
    const translocoSpy = { translate: (key: string) => translations[key] ?? key };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NotifyService, useValue: notifySpy },
        { provide: Router, useValue: routerSpy },
        { provide: TranslocoService, useValue: translocoSpy }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('withCredentials', () => {
    it('flags every outgoing request with withCredentials so cookies ride along', () => {
      httpClient.get(protectedUrl).subscribe();

      const req = httpMock.expectOne(protectedUrl);
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });
  });

  describe('401 on a non-auth endpoint', () => {
    it('triggers /api/auth/refresh and retries the original request on success', () => {
      authServiceSpy.refresh.mockReturnValue(of(refreshedSession));

      const result = vi.fn();
      httpClient.get(protectedUrl).subscribe(result);

      const first = httpMock.expectOne(protectedUrl);
      first.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

      expect(authServiceSpy.refresh).toHaveBeenCalledTimes(1);

      const retry = httpMock.expectOne(protectedUrl);
      retry.flush({ id: 'L1' });
      expect(result).toHaveBeenCalledWith({ id: 'L1' });
      expect(authServiceSpy.logout).not.toHaveBeenCalled();
    });

    it('logs out and stashes the redirect URL when the refresh itself fails', () => {
      authServiceSpy.refresh.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 }))
      );

      const errored = vi.fn();
      httpClient.get(protectedUrl).subscribe({ error: errored });

      httpMock.expectOne(protectedUrl)
        .flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

      expect(authServiceSpy.refresh).toHaveBeenCalled();
      expect(authServiceSpy.setRedirectUrl).toHaveBeenCalledWith('/admin/lines');
      expect(authServiceSpy.logout).toHaveBeenCalled();
      expect(errored).toHaveBeenCalled();
    });

    it('does not stash the redirect URL for public-display routes', () => {
      routerSpy.url = '/display/abc';
      authServiceSpy.refresh.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 401 }))
      );

      httpClient.get(protectedUrl).subscribe({ error: () => undefined });
      httpMock.expectOne(protectedUrl)
        .flush({ message: 'gone' }, { status: 401, statusText: 'Unauthorized' });

      expect(authServiceSpy.setRedirectUrl).not.toHaveBeenCalled();
      expect(authServiceSpy.logout).toHaveBeenCalled();
    });
  });

  describe('401 on an /api/auth/ endpoint', () => {
    it('does not trigger /refresh — the auth call propagates the error as-is', () => {
      httpClient.post(loginUrl, { username: 'a', password: 'b' }).subscribe({
        error: (err: HttpErrorResponse) => expect(err.status).toBe(401)
      });

      httpMock.expectOne(loginUrl)
        .flush({ message: 'bad creds' }, { status: 401, statusText: 'Unauthorized' });

      expect(authServiceSpy.refresh).not.toHaveBeenCalled();
      expect(authServiceSpy.logout).not.toHaveBeenCalled();
    });

    it('does not loop refresh on /api/auth/refresh 401', () => {
      httpClient.post(refreshUrl, null).subscribe({ error: () => undefined });

      httpMock.expectOne(refreshUrl)
        .flush({ message: 'gone' }, { status: 401, statusText: 'Unauthorized' });

      expect(authServiceSpy.refresh).not.toHaveBeenCalled();
    });
  });

  describe('403', () => {
    it('shows a notify and propagates the error', () => {
      httpClient.get(protectedUrl).subscribe({
        error: (err: HttpErrorResponse) => expect(err.status).toBe(403)
      });

      httpMock.expectOne(protectedUrl)
        .flush({ message: 'no' }, { status: 403, statusText: 'Forbidden' });

      expect(notifySpy.error).toHaveBeenCalledWith('Access denied: insufficient permissions');
    });
  });

  describe('passthrough', () => {
    it('passes successful responses through unchanged', () => {
      const result = vi.fn();
      httpClient.get(protectedUrl).subscribe(result);
      httpMock.expectOne(protectedUrl).flush({ ok: true });
      expect(result).toHaveBeenCalledWith({ ok: true });
    });

    it('leaves 500 responses to the caller, no refresh attempted', () => {
      httpClient.get(protectedUrl).subscribe({
        error: (err: HttpErrorResponse) => expect(err.status).toBe(500)
      });

      httpMock.expectOne(protectedUrl)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

      expect(authServiceSpy.refresh).not.toHaveBeenCalled();
    });
  });
});
