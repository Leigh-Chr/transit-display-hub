import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { StopService } from './stop.service';
import { Stop, CreateStopRequest } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('StopService', () => {
  let service: StopService;
  let httpMock: HttpTestingController;

  const mockLine = {
    id: 'line-123',
    code: 'L1',
    name: 'Metro Line 1',
    color: '#FF5733'
  };

  const mockStop: Stop = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Central Station',
    latitude: 48.8566,
    longitude: 2.3522,
    lines: [mockLine],
    scheduleCount: 10,
    hasDevice: true
  };

  const mockStops: Stop[] = [
    mockStop,
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      name: 'North Station',
      latitude: null,
      longitude: null,
      lines: [mockLine],
      scheduleCount: 8,
      hasDevice: false
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        StopService
      ]
    });

    service = TestBed.inject(StopService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('should return all stops without filter', () => {
      service.getAll().subscribe(stops => {
        expect(stops).toEqual(mockStops);
        expect(stops.length).toBe(2);
      });

      const req = httpMock.expectOne('/api/stops/all');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('lineId')).toBe(false);
      req.flush(mockStops);
    });

    it('should filter by lineId when provided', () => {
      service.getAll('line-123').subscribe(stops => {
        expect(stops).toEqual(mockStops);
      });

      const req = httpMock.expectOne('/api/stops/all?lineId=line-123');
      expect(req.request.params.get('lineId')).toBe('line-123');
      req.flush(mockStops);
    });

    it('should return empty array when no stops', () => {
      service.getAll().subscribe(stops => {
        expect(stops).toEqual([]);
      });

      const req = httpMock.expectOne('/api/stops/all');
      req.flush([]);
    });
  });

  describe('create', () => {
    it('should create a new stop', () => {
      const request: CreateStopRequest = {
        name: 'New Station',
        lineIds: ['line-123']
      };
      const createdStop: Stop = {
        id: '333e4567-e89b-12d3-a456-426614174000',
        name: request.name,
        latitude: null,
        longitude: null,
        lines: [mockLine],
        scheduleCount: 0,
        hasDevice: false
      };

      service.create(request).subscribe(stop => {
        expect(stop).toEqual(createdStop);
        expect(stop.name).toBe('New Station');
      });

      const req = httpMock.expectOne('/api/stops');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(createdStop);
    });

    it('should propagate 404 error for non-existent line', () => {
      const request: CreateStopRequest = {
        name: 'Station',
        lineIds: ['non-existent-line']
      };

      service.create(request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne('/api/stops');
      req.flush({ message: 'Line not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('update', () => {
    it('should update an existing stop', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: CreateStopRequest = {
        name: 'Updated Station',
        lineIds: ['line-123']
      };
      const updatedStop: Stop = {
        ...mockStop,
        name: request.name
      };

      service.update(id, request).subscribe(stop => {
        expect(stop).toEqual(updatedStop);
        expect(stop.name).toBe('Updated Station');
      });

      const req = httpMock.expectOne(`/api/stops/${id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(updatedStop);
    });

    it('should propagate 404 error for non-existent stop', () => {
      const id = 'non-existent-id';
      const request: CreateStopRequest = {
        name: 'Station',
        lineIds: ['line-123']
      };

      service.update(id, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/stops/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('delete', () => {
    it('should delete a stop', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.delete(id).subscribe(() => {
        // Success - no response body expected
      });

      const req = httpMock.expectOne(`/api/stops/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should propagate 404 error for non-existent stop', () => {
      const id = 'non-existent-id';

      service.delete(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/stops/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });
});
