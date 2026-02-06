import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DisplayService } from './display.service';
import { DisplayState } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('DisplayService', () => {
  let service: DisplayService;
  let httpMock: HttpTestingController;

  const mockDisplayState: DisplayState = {
    stopId: 'stop-123',
    stopName: 'Central Station',
    lines: [
      {
        id: 'line-1',
        code: 'L1',
        name: 'Metro Line 1',
        color: '#FF5733'
      }
    ],
    arrivals: [
      {
        scheduledTime: '08:30',
        destinationName: 'Terminal',
        line: {
          id: 'line-1',
          code: 'L1',
          name: 'Metro Line 1',
          color: '#FF5733'
        }
      },
      {
        scheduledTime: '08:45',
        destinationName: 'Terminal',
        line: {
          id: 'line-1',
          code: 'L1',
          name: 'Metro Line 1',
          color: '#FF5733'
        }
      }
    ],
    messages: [
      {
        title: 'Service Update',
        content: 'Delays expected due to maintenance',
        severity: 'WARNING'
      }
    ],
    version: 42,
    generatedAt: '2024-01-15T10:30:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DisplayService
      ]
    });

    service = TestBed.inject(DisplayService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getState', () => {
    it('should return display state for a stop', () => {
      const stopId = 'stop-123';

      service.getState(stopId).subscribe(state => {
        expect(state).toEqual(mockDisplayState);
        expect(state.stopName).toBe('Central Station');
        expect(state.arrivals.length).toBe(2);
        expect(state.messages.length).toBe(1);
      });

      const req = httpMock.expectOne(`/api/display/${stopId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDisplayState);
    });

    it('should return display state with empty arrivals and messages', () => {
      const stopId = 'stop-456';
      const emptyState: DisplayState = {
        ...mockDisplayState,
        stopId: 'stop-456',
        arrivals: [],
        messages: []
      };

      service.getState(stopId).subscribe(state => {
        expect(state.arrivals).toEqual([]);
        expect(state.messages).toEqual([]);
      });

      const req = httpMock.expectOne(`/api/display/${stopId}`);
      req.flush(emptyState);
    });

    it('should propagate 404 error for non-existent stop', () => {
      const stopId = 'non-existent-stop';

      service.getState(stopId).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/display/${stopId}`);
      req.flush({ message: 'Stop not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('getStateByToken', () => {
    it('should return display state using device token', () => {
      const token = 'device-token-abc123';

      service.getStateByToken(token).subscribe(state => {
        expect(state).toEqual(mockDisplayState);
      });

      const req = httpMock.expectOne('/api/display');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('X-Device-Token')).toBe(token);
      req.flush(mockDisplayState);
    });

    it('should set X-Device-Token header', () => {
      const token = 'my-secret-token';

      service.getStateByToken(token).subscribe();

      const req = httpMock.expectOne('/api/display');
      expect(req.request.headers.has('X-Device-Token')).toBe(true);
      expect(req.request.headers.get('X-Device-Token')).toBe('my-secret-token');
      req.flush(mockDisplayState);
    });

    it('should propagate 401 error for invalid token', () => {
      const token = 'invalid-token';

      service.getStateByToken(token).subscribe({
        error: (err) => {
          expect(err.status).toBe(401);
        }
      });

      const req = httpMock.expectOne('/api/display');
      req.flush({ message: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should propagate 403 error for disabled device', () => {
      const token = 'disabled-device-token';

      service.getStateByToken(token).subscribe({
        error: (err) => {
          expect(err.status).toBe(403);
        }
      });

      const req = httpMock.expectOne('/api/display');
      req.flush({ message: 'Device disabled' }, { status: 403, statusText: 'Forbidden' });
    });
  });
});
