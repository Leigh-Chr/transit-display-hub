import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

describe('authGuard', () => {
  let authServiceSpy: { isAuthenticated: MockedFunction<() => boolean> };
  let routerSpy: { navigate: MockedFunction<Router['navigate']> };
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;

  beforeEach(() => {
    authServiceSpy = { isAuthenticated: vi.fn() };
    routerSpy = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    mockRoute = {} as ActivatedRouteSnapshot;
    mockState = { url: '/admin' } as RouterStateSnapshot;
  });

  it('should return true when user is authenticated', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(result).toBe(true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should return false when user is not authenticated', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(result).toBe(false);
  });

  it('should navigate to /login when user is not authenticated', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(false);

    TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should not navigate when user is authenticated', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(true);

    TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should check authentication status using isAuthenticated signal', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(true);

    TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(authServiceSpy.isAuthenticated).toHaveBeenCalled();
  });
});
