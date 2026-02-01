import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    const routerSpyObj = jasmine.createSpyObj('Router', ['navigate']);

    // Make isAuthenticated return a callable that returns boolean
    authSpy.isAuthenticated = jasmine.createSpy('isAuthenticated');

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpyObj }
      ]
    });

    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    mockRoute = {} as ActivatedRouteSnapshot;
    mockState = { url: '/admin' } as RouterStateSnapshot;
  });

  it('should return true when user is authenticated', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(result).toBeTrue();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should return false when user is not authenticated', () => {
    authServiceSpy.isAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(result).toBeFalse();
  });

  it('should navigate to /login when user is not authenticated', () => {
    authServiceSpy.isAuthenticated.and.returnValue(false);

    TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should not navigate when user is authenticated', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);

    TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should check authentication status using isAuthenticated signal', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);

    TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));

    expect(authServiceSpy.isAuthenticated).toHaveBeenCalled();
  });
});
