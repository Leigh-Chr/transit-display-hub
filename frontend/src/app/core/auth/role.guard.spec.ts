import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

describe('roleGuard', () => {
  let authServiceSpy: { getRole: MockedFunction<() => string | null> };
  let routerSpy: { navigate: MockedFunction<Router['navigate']> };
  let snackBarSpy: { open: MockedFunction<MatSnackBar['open']> };
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;

  beforeEach(() => {
    authServiceSpy = { getRole: vi.fn() };
    routerSpy = { navigate: vi.fn() };
    snackBarSpy = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    });

    mockRoute = { data: { requiredRole: 'ADMIN' } } as unknown as ActivatedRouteSnapshot;
    mockState = { url: '/admin/lines' } as RouterStateSnapshot;
  });

  it('should return true when role matches', () => {
    authServiceSpy.getRole.mockReturnValue('ADMIN');

    const result = TestBed.runInInjectionContext(() => roleGuard(mockRoute, mockState));

    expect(result).toBe(true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should return false and redirect to /admin/dashboard when role does not match', () => {
    authServiceSpy.getRole.mockReturnValue('AGENT');

    const result = TestBed.runInInjectionContext(() => roleGuard(mockRoute, mockState));

    expect(result).toBe(false);
    expect(snackBarSpy.open).toHaveBeenCalledWith(
      'Access denied: insufficient permissions',
      'Close',
      { duration: 5000, panelClass: 'error-snackbar' }
    );
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should return true when no requiredRole is defined in route data', () => {
    mockRoute = { data: {} } as unknown as ActivatedRouteSnapshot;
    authServiceSpy.getRole.mockReturnValue('AGENT');

    const result = TestBed.runInInjectionContext(() => roleGuard(mockRoute, mockState));

    expect(result).toBe(true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should return true when route data is empty', () => {
    mockRoute = { data: {} } as unknown as ActivatedRouteSnapshot;
    authServiceSpy.getRole.mockReturnValue('ADMIN');

    const result = TestBed.runInInjectionContext(() => roleGuard(mockRoute, mockState));

    expect(result).toBe(true);
  });
});
