import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: {
    getToken: MockedFunction<() => string | null>;
    logout: MockedFunction<() => void>;
  };
  let snackBarSpy: {
    open: MockedFunction<MatSnackBar['open']>;
  };

  const testUrl = '/api/test';
  const loginUrl = '/api/auth/login';

  beforeEach(() => {
    authServiceSpy = {
      getToken: vi.fn(),
      logout: vi.fn()
    };
    snackBarSpy = {
      open: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Authorization header', () => {
    it('should add Authorization header when token exists', () => {
      authServiceSpy.getToken.mockReturnValue('test-token');

      httpClient.get(testUrl).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({});
    });

    it('should not add Authorization header when no token exists', () => {
      authServiceSpy.getToken.mockReturnValue(null);

      httpClient.get(testUrl).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });

    it('should format token as Bearer token', () => {
      authServiceSpy.getToken.mockReturnValue('my-jwt-token');

      httpClient.get(testUrl).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush({});
    });
  });

  describe('401 error handling', () => {
    it('should call logout on 401 error', () => {
      authServiceSpy.getToken.mockReturnValue('token');

      httpClient.get(testUrl).subscribe({
        error: () => {
          expect(authServiceSpy.logout).toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should not call logout for 401 on login endpoint', () => {
      authServiceSpy.getToken.mockReturnValue(null);

      httpClient.post(loginUrl, {}).subscribe({
        error: () => {
          expect(authServiceSpy.logout).not.toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(loginUrl);
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should re-throw the error after handling', () => {
      authServiceSpy.getToken.mockReturnValue('token');

      httpClient.get(testUrl).subscribe({
        error: (err: HttpErrorResponse) => {
          expect(err.status).toBe(401);
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should not call logout for other error statuses', () => {
      authServiceSpy.getToken.mockReturnValue('token');

      httpClient.get(testUrl).subscribe({
        error: () => {
          expect(authServiceSpy.logout).not.toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    });

    it('should not call logout for 403 errors', () => {
      authServiceSpy.getToken.mockReturnValue('token');

      httpClient.get(testUrl).subscribe({
        error: () => {
          expect(authServiceSpy.logout).not.toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('403 error handling', () => {
    it('should show snackbar on 403 error', () => {
      authServiceSpy.getToken.mockReturnValue('token');

      httpClient.get(testUrl).subscribe({
        error: () => {
          expect(snackBarSpy.open).toHaveBeenCalledWith(
            'Access denied: insufficient permissions',
            'Close',
            { duration: 5000 }
          );
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    });

    it('should re-throw the error after showing snackbar', () => {
      authServiceSpy.getToken.mockReturnValue('token');

      httpClient.get(testUrl).subscribe({
        error: (err: HttpErrorResponse) => {
          expect(err.status).toBe(403);
          expect(snackBarSpy.open).toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    });

    it('should not show snackbar for non-403 errors', () => {
      authServiceSpy.getToken.mockReturnValue('token');

      httpClient.get(testUrl).subscribe({
        error: () => {
          expect(snackBarSpy.open).not.toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('request passthrough', () => {
    it('should pass through successful requests', () => {
      authServiceSpy.getToken.mockReturnValue('token');
      const responseData = { data: 'test' };

      httpClient.get(testUrl).subscribe(response => {
        expect(response).toEqual(responseData);
      });

      const req = httpMock.expectOne(testUrl);
      req.flush(responseData);
    });

    it('should preserve original request method', () => {
      authServiceSpy.getToken.mockReturnValue('token');

      httpClient.post(testUrl, { data: 'test' }).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should preserve original request body', () => {
      authServiceSpy.getToken.mockReturnValue('token');
      const requestBody = { username: 'test', password: 'password' };

      httpClient.post(testUrl, requestBody).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.body).toEqual(requestBody);
      req.flush({});
    });
  });
});
