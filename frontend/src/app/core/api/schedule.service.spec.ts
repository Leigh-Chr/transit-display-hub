import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ScheduleService } from './schedule.service';
import { TimedEntry, CreateTimedEntryRequest } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let httpMock: HttpTestingController;

  const mockLine = {
    code: 'L1',
    name: 'Metro Line 1',
    color: '#FF5733'
  };

  const mockEntry: TimedEntry = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    stopId: 'stop-123',
    time: '08:30:00',
    line: mockLine
  };

  const mockEntries: TimedEntry[] = [
    mockEntry,
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      stopId: 'stop-123',
      time: '09:00:00',
      line: mockLine
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ScheduleService
      ]
    });

    service = TestBed.inject(ScheduleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getForStop', () => {
    it('should return schedule entries for a stop', () => {
      const stopId = 'stop-123';

      service.getForStop(stopId).subscribe(entries => {
        expect(entries).toEqual(mockEntries);
        expect(entries.length).toBe(2);
      });

      const req = httpMock.expectOne(`/api/stops/${stopId}/schedules`);
      expect(req.request.method).toBe('GET');
      req.flush(mockEntries);
    });

    it('should return empty array when no entries', () => {
      const stopId = 'stop-123';

      service.getForStop(stopId).subscribe(entries => {
        expect(entries).toEqual([]);
      });

      const req = httpMock.expectOne(`/api/stops/${stopId}/schedules`);
      req.flush([]);
    });

    it('should propagate 404 error for non-existent stop', () => {
      const stopId = 'non-existent-stop';

      service.getForStop(stopId).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/stops/${stopId}/schedules`);
      req.flush({ message: 'Stop not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('create', () => {
    it('should create a new schedule entry', () => {
      const stopId = 'stop-123';
      const request: CreateTimedEntryRequest = {
        time: '10:00',
        lineId: 'line-123'
      };
      const createdEntry: TimedEntry = {
        id: '333e4567-e89b-12d3-a456-426614174000',
        stopId,
        time: '10:00:00',
        line: mockLine
      };

      service.create(stopId, request).subscribe(entry => {
        expect(entry).toEqual(createdEntry);
        expect(entry.time).toBe('10:00:00');
      });

      const req = httpMock.expectOne(`/api/stops/${stopId}/schedules`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(createdEntry);
    });

    it('should propagate 404 error for non-existent stop', () => {
      const stopId = 'non-existent-stop';
      const request: CreateTimedEntryRequest = {
        time: '10:00',
        lineId: 'line-123'
      };

      service.create(stopId, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/stops/${stopId}/schedules`);
      req.flush({ message: 'Stop not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('update', () => {
    it('should update an existing schedule entry', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: CreateTimedEntryRequest = {
        time: '08:45',
        lineId: 'line-123'
      };
      const updatedEntry: TimedEntry = {
        ...mockEntry,
        time: '08:45:00'
      };

      service.update(id, request).subscribe(entry => {
        expect(entry).toEqual(updatedEntry);
        expect(entry.time).toBe('08:45:00');
      });

      const req = httpMock.expectOne(`/api/schedules/${id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(updatedEntry);
    });

    it('should propagate 404 error for non-existent entry', () => {
      const id = 'non-existent-id';
      const request: CreateTimedEntryRequest = {
        time: '10:00',
        lineId: 'line-123'
      };

      service.update(id, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/schedules/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('delete', () => {
    it('should delete a schedule entry', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.delete(id).subscribe(() => {
        // Success - no response body expected
      });

      const req = httpMock.expectOne(`/api/schedules/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should propagate 404 error for non-existent entry', () => {
      const id = 'non-existent-id';

      service.delete(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/schedules/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });
});
