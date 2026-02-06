import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LoginRequest, LoginResponse } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: { navigate: MockedFunction<Router['navigate']> };

  // Valid JWT token for testing (expires far in the future)
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiIsImV4cCI6OTk5OTk5OTk5OX0.signature';
  // Expired JWT token
  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiIsImV4cCI6MX0.signature';
  // Malformed token
  const malformedToken = 'not.a.valid.jwt.token';

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

    // Clear localStorage before each test
    localStorage.clear();

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('login', () => {
    it('should store token on successful login', () => {
      const request: LoginRequest = { username: 'admin', password: 'admin123' };
      const response: LoginResponse = {
        token: validToken,
        expiresAt: new Date().toISOString(),
        role: 'ADMIN',
        username: 'admin'
      };

      service.login(request).subscribe(res => {
        expect(res.token).toBe(validToken);
        expect(localStorage.getItem('auth_token')).toBe(validToken);
      });

      const req = httpMock.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(response);
    });

    it('should update isAuthenticated signal after login', () => {
      const request: LoginRequest = { username: 'admin', password: 'admin123' };
      const response: LoginResponse = {
        token: validToken,
        expiresAt: new Date().toISOString(),
        role: 'ADMIN',
        username: 'admin'
      };

      expect(service.isAuthenticated()).toBe(false);

      service.login(request).subscribe(() => {
        expect(service.isAuthenticated()).toBe(true);
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush(response);
    });

    it('should propagate HTTP errors', () => {
      const request: LoginRequest = { username: 'admin', password: 'wrong' };

      service.login(request).subscribe({
        error: (err) => {
          expect(err.status).toBe(401);
        }
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('logout', () => {
    it('should clear token from localStorage', () => {
      localStorage.setItem('auth_token', validToken);

      service.logout();

      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should navigate to /login', () => {
      localStorage.setItem('auth_token', validToken);

      service.logout();

      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should update isAuthenticated to false', () => {
      // Simulate logged in state by setting token
      localStorage.setItem('auth_token', validToken);
      // Need to recreate service to pick up the stored token
      service = TestBed.inject(AuthService);

      service.logout();

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token exists', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return true when valid token exists after login', () => {
      // Simulate login flow to properly set token via the service
      const request = { username: 'admin', password: 'admin123' };
      const response = {
        token: validToken,
        expiresAt: new Date().toISOString(),
        role: 'ADMIN' as const,
        username: 'admin'
      };

      service.login(request).subscribe();
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(response);

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when token is expired', () => {
      // For expired token test, we need to manually trigger the signal
      // Since the expiredToken's exp is in the past, isTokenExpired will return true
      localStorage.setItem('auth_token', expiredToken);
      // Force a new service instance with the stored token
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          AuthService,
          { provide: Router, useValue: { navigate: vi.fn() } }
        ]
      });
      service = TestBed.inject(AuthService);
      httpMock = TestBed.inject(HttpTestingController);

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('currentUser', () => {
    it('should return null when no token exists', () => {
      expect(service.currentUser()).toBeNull();
    });

    it('should decode username from valid token after login', () => {
      const request = { username: 'admin', password: 'admin123' };
      const response = {
        token: validToken,
        expiresAt: new Date().toISOString(),
        role: 'ADMIN' as const,
        username: 'admin'
      };

      service.login(request).subscribe();
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(response);

      const user = service.currentUser();
      expect(user).not.toBeNull();
      expect(user?.username).toBe('admin');
    });

    it('should decode role from valid token after login', () => {
      const request = { username: 'admin', password: 'admin123' };
      const response = {
        token: validToken,
        expiresAt: new Date().toISOString(),
        role: 'ADMIN' as const,
        username: 'admin'
      };

      service.login(request).subscribe();
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(response);

      const user = service.currentUser();
      expect(user?.role).toBe('ADMIN');
    });

    it('should return null for malformed token', () => {
      localStorage.setItem('auth_token', malformedToken);
      // Reset and recreate to pick up malformed token
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          AuthService,
          { provide: Router, useValue: { navigate: vi.fn() } }
        ]
      });
      service = TestBed.inject(AuthService);
      httpMock = TestBed.inject(HttpTestingController);

      expect(service.currentUser()).toBeNull();
    });
  });

  describe('getToken', () => {
    it('should return null when no token stored', () => {
      expect(service.getToken()).toBeNull();
    });

    it('should return stored token after login', () => {
      const request = { username: 'admin', password: 'admin123' };
      const response = {
        token: validToken,
        expiresAt: new Date().toISOString(),
        role: 'ADMIN' as const,
        username: 'admin'
      };

      service.login(request).subscribe();
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(response);

      expect(service.getToken()).toBe(validToken);
    });
  });

  describe('getRole', () => {
    it('should return null when not authenticated', () => {
      expect(service.getRole()).toBeNull();
    });

    it('should return user role when authenticated after login', () => {
      const request = { username: 'admin', password: 'admin123' };
      const response = {
        token: validToken,
        expiresAt: new Date().toISOString(),
        role: 'ADMIN' as const,
        username: 'admin'
      };

      service.login(request).subscribe();
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(response);

      expect(service.getRole()).toBe('ADMIN');
    });
  });

  describe('isAdmin', () => {
    it('should return false when not authenticated', () => {
      expect(service.isAdmin()).toBe(false);
    });

    it('should return true when user has ADMIN role', () => {
      const request: LoginRequest = { username: 'admin', password: 'admin123' };
      const response: LoginResponse = {
        token: validToken,
        expiresAt: new Date().toISOString(),
        role: 'ADMIN',
        username: 'admin'
      };

      service.login(request).subscribe();
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(response);

      expect(service.isAdmin()).toBe(true);
    });

    it('should return false when user has AGENT role', () => {
      const agentToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZ2VudCIsInJvbGUiOiJBR0VOVCIsImV4cCI6OTk5OTk5OTk5OX0.signature';
      const request: LoginRequest = { username: 'agent', password: 'agent123' };
      const response: LoginResponse = {
        token: agentToken,
        expiresAt: new Date().toISOString(),
        role: 'AGENT',
        username: 'agent'
      };

      service.login(request).subscribe();
      const req = httpMock.expectOne('/api/auth/login');
      req.flush(response);

      expect(service.isAdmin()).toBe(false);
    });
  });
});
