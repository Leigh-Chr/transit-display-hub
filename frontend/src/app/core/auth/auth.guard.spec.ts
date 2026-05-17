import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

describe('authGuard', () => {
  let authServiceSpy: {
    isAuthenticated: MockedFunction<() => boolean>;
    passwordMustChange: MockedFunction<() => boolean>;
  };
  let routerSpy: {
    navigate: MockedFunction<Router['navigate']>;
    createUrlTree: MockedFunction<Router['createUrlTree']>;
  };
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;
  const stubUrlTree = {} as UrlTree;

  beforeEach(() => {
    authServiceSpy = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      passwordMustChange: vi.fn().mockReturnValue(false),
    };
    routerSpy = {
      navigate: vi.fn(),
      createUrlTree: vi.fn().mockReturnValue(stubUrlTree),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    mockRoute = {} as ActivatedRouteSnapshot;
    mockState = { url: '/admin' } as RouterStateSnapshot;
  });

  it('should return true when user is authenticated and not flagged', () => {
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

  it('redirects to /auth/change-password when passwordMustChange is set', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(true);
    authServiceSpy.passwordMustChange.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/auth/change-password']);
    expect(result).toBe(stubUrlTree);
  });

  it('lets the user through when already on /auth/change-password even if flagged', () => {
    authServiceSpy.isAuthenticated.mockReturnValue(true);
    authServiceSpy.passwordMustChange.mockReturnValue(true);
    const onRotationRoute = { url: '/auth/change-password' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, onRotationRoute));

    expect(result).toBe(true);
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });
});
