import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { NotifyService } from '@core/services/notify.service';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

describe('roleGuard', () => {
  let authServiceSpy: { getRole: MockedFunction<() => string | null> };
  let routerSpy: { navigate: MockedFunction<Router['navigate']> };
  let notifySpy: { error: MockedFunction<NotifyService['error']> };
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;

  beforeEach(() => {
    authServiceSpy = { getRole: vi.fn() };
    routerSpy = { navigate: vi.fn() };
    notifySpy = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: NotifyService, useValue: notifySpy }
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
    expect(notifySpy.error).toHaveBeenCalledWith(
      'Access denied: insufficient permissions'
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
