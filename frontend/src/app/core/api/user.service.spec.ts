import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { User, CreateUserRequest, UpdateUserRequest, PageResponse } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'admin',
    role: 'ADMIN',
    enabled: true
  };

  const mockUsers: User[] = [
    mockUser,
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      username: 'agent',
      role: 'AGENT',
      enabled: true
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UserService
      ]
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('should return all users', () => {
      service.getAll().subscribe(users => {
        expect(users).toEqual(mockUsers);
        expect(users.length).toBe(2);
      });

      const req = httpMock.expectOne('/api/users');
      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);
    });

    it('should return empty array when no users', () => {
      service.getAll().subscribe(users => {
        expect(users).toEqual([]);
      });

      const req = httpMock.expectOne('/api/users');
      req.flush([]);
    });
  });

  describe('getAllPaginated', () => {
    const mockPageResponse: PageResponse<User> = {
      content: mockUsers,
      page: 0,
      size: 10,
      totalElements: 2,
      totalPages: 1,
      first: true,
      last: true
    };

    it('should send pagination params', () => {
      service.getAllPaginated({ page: 0, size: 20, sortBy: 'username', sortDir: 'desc', search: 'admin' }).subscribe(response => {
        expect(response).toEqual(mockPageResponse);
      });

      const req = httpMock.expectOne(r =>
        r.url === '/api/users' &&
        r.params.get('page') === '0' &&
        r.params.get('size') === '20' &&
        r.params.get('sortBy') === 'username' &&
        r.params.get('sortDir') === 'desc' &&
        r.params.get('search') === 'admin'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPageResponse);
    });

    it('should use default page 0 when no params provided', () => {
      service.getAllPaginated().subscribe();

      const req = httpMock.expectOne(r =>
        r.url === '/api/users' &&
        r.params.get('page') === '0'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPageResponse);
    });
  });

  describe('get', () => {
    it('should return a single user by id', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.get(id).subscribe(user => {
        expect(user).toEqual(mockUser);
      });

      const req = httpMock.expectOne(`/api/users/${id}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUser);
    });

    it('should propagate 404 error', () => {
      const id = 'non-existent-id';

      service.get(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/users/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('create', () => {
    it('should create a new user', () => {
      const request: CreateUserRequest = {
        username: 'newuser',
        password: 'password123',
        role: 'AGENT'
      };
      const createdUser: User = {
        id: '333e4567-e89b-12d3-a456-426614174000',
        username: 'newuser',
        role: 'AGENT',
        enabled: true
      };

      service.create(request).subscribe(user => {
        expect(user).toEqual(createdUser);
      });

      const req = httpMock.expectOne('/api/users');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(createdUser);
    });

    it('should propagate 400 error for duplicate username', () => {
      const request: CreateUserRequest = {
        username: 'admin',
        password: 'password123',
        role: 'ADMIN'
      };

      service.create(request).subscribe({
        error: (err) => {
          expect(err.status).toBe(400);
        }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ message: 'Username already exists' }, { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('update', () => {
    it('should update an existing user', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: UpdateUserRequest = {
        role: 'AGENT',
        enabled: false
      };
      const updatedUser: User = {
        id,
        username: 'admin',
        role: 'AGENT',
        enabled: false
      };

      service.update(id, request).subscribe(user => {
        expect(user).toEqual(updatedUser);
      });

      const req = httpMock.expectOne(`/api/users/${id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(updatedUser);
    });

    it('should propagate 404 error', () => {
      const id = 'non-existent-id';
      const request: UpdateUserRequest = { role: 'ADMIN', enabled: true };

      service.update(id, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/users/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('delete', () => {
    it('should delete a user', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.delete(id).subscribe();

      const req = httpMock.expectOne(`/api/users/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should propagate 404 error', () => {
      const id = 'non-existent-id';

      service.delete(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/users/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });
});
