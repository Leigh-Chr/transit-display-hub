import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const testUrl = '/api/test';
  const loginUrl = '/api/auth/login';

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AuthService', ['getToken', 'logout']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: spy }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Authorization header', () => {
    it('should add Authorization header when token exists', () => {
      authServiceSpy.getToken.and.returnValue('test-token');

      httpClient.get(testUrl).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({});
    });

    it('should not add Authorization header when no token exists', () => {
      authServiceSpy.getToken.and.returnValue(null);

      httpClient.get(testUrl).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('should format token as Bearer token', () => {
      authServiceSpy.getToken.and.returnValue('my-jwt-token');

      httpClient.get(testUrl).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
      req.flush({});
    });
  });

  describe('401 error handling', () => {
    it('should call logout on 401 error', () => {
      authServiceSpy.getToken.and.returnValue('token');

      httpClient.get(testUrl).subscribe({
        error: () => {
          expect(authServiceSpy.logout).toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should not call logout for 401 on login endpoint', () => {
      authServiceSpy.getToken.and.returnValue(null);

      httpClient.post(loginUrl, {}).subscribe({
        error: () => {
          expect(authServiceSpy.logout).not.toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(loginUrl);
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should re-throw the error after handling', () => {
      authServiceSpy.getToken.and.returnValue('token');

      httpClient.get(testUrl).subscribe({
        error: (err: HttpErrorResponse) => {
          expect(err.status).toBe(401);
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should not call logout for other error statuses', () => {
      authServiceSpy.getToken.and.returnValue('token');

      httpClient.get(testUrl).subscribe({
        error: () => {
          expect(authServiceSpy.logout).not.toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    });

    it('should not call logout for 403 errors', () => {
      authServiceSpy.getToken.and.returnValue('token');

      httpClient.get(testUrl).subscribe({
        error: () => {
          expect(authServiceSpy.logout).not.toHaveBeenCalled();
        }
      });

      const req = httpMock.expectOne(testUrl);
      req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('request passthrough', () => {
    it('should pass through successful requests', () => {
      authServiceSpy.getToken.and.returnValue('token');
      const responseData = { data: 'test' };

      httpClient.get(testUrl).subscribe(response => {
        expect(response).toEqual(responseData);
      });

      const req = httpMock.expectOne(testUrl);
      req.flush(responseData);
    });

    it('should preserve original request method', () => {
      authServiceSpy.getToken.and.returnValue('token');

      httpClient.post(testUrl, { data: 'test' }).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should preserve original request body', () => {
      authServiceSpy.getToken.and.returnValue('token');
      const requestBody = { username: 'test', password: 'password' };

      httpClient.post(testUrl, requestBody).subscribe();

      const req = httpMock.expectOne(testUrl);
      expect(req.request.body).toEqual(requestBody);
      req.flush({});
    });
  });
});
