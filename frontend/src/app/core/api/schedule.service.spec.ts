import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ScheduleService } from './schedule.service';
import { Schedule, CreateScheduleRequest } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let httpMock: HttpTestingController;

  const mockLine = {
    id: 'line-123',
    code: 'L1',
    name: 'Metro Line 1',
    color: '#FF5733'
  };

  const mockItinerary = {
    id: 'itinerary-123',
    name: 'Direction Eastern Terminal',
    terminusName: 'Eastern Terminal',
    line: mockLine
  };

  const mockSchedule: Schedule = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    stopId: 'stop-123',
    time: '08:30:00',
    itinerary: mockItinerary
  };

  const mockSchedules: Schedule[] = [
    mockSchedule,
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      stopId: 'stop-123',
      time: '09:00:00',
      itinerary: mockItinerary
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

      service.getForStop(stopId).subscribe(schedules => {
        expect(schedules).toEqual(mockSchedules);
        expect(schedules.length).toBe(2);
      });

      const req = httpMock.expectOne(`/api/v2/stops/${stopId}/schedules`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSchedules);
    });

    it('should return empty array when no entries', () => {
      const stopId = 'stop-123';

      service.getForStop(stopId).subscribe(schedules => {
        expect(schedules).toEqual([]);
      });

      const req = httpMock.expectOne(`/api/v2/stops/${stopId}/schedules`);
      req.flush([]);
    });

    it('should propagate 404 error for non-existent stop', () => {
      const stopId = 'non-existent-stop';

      service.getForStop(stopId).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/v2/stops/${stopId}/schedules`);
      req.flush({ message: 'Stop not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('create', () => {
    it('should create a new schedule entry', () => {
      const stopId = 'stop-123';
      const request: CreateScheduleRequest = {
        time: '10:00',
        itineraryId: 'itinerary-123'
      };
      const createdSchedule: Schedule = {
        id: '333e4567-e89b-12d3-a456-426614174000',
        stopId,
        time: '10:00:00',
        itinerary: mockItinerary
      };

      service.create(stopId, request).subscribe(schedule => {
        expect(schedule).toEqual(createdSchedule);
        expect(schedule.time).toBe('10:00:00');
      });

      const req = httpMock.expectOne(`/api/v2/stops/${stopId}/schedules`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(createdSchedule);
    });

    it('should propagate 404 error for non-existent stop', () => {
      const stopId = 'non-existent-stop';
      const request: CreateScheduleRequest = {
        time: '10:00',
        itineraryId: 'itinerary-123'
      };

      service.create(stopId, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/v2/stops/${stopId}/schedules`);
      req.flush({ message: 'Stop not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('update', () => {
    it('should update an existing schedule entry', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: CreateScheduleRequest = {
        time: '08:45',
        itineraryId: 'itinerary-123'
      };
      const updatedSchedule: Schedule = {
        ...mockSchedule,
        time: '08:45:00'
      };

      service.update(id, request).subscribe(schedule => {
        expect(schedule).toEqual(updatedSchedule);
        expect(schedule.time).toBe('08:45:00');
      });

      const req = httpMock.expectOne(`/api/v2/schedules/${id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(updatedSchedule);
    });

    it('should propagate 404 error for non-existent entry', () => {
      const id = 'non-existent-id';
      const request: CreateScheduleRequest = {
        time: '10:00',
        itineraryId: 'itinerary-123'
      };

      service.update(id, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/v2/schedules/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('delete', () => {
    it('should delete a schedule entry', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.delete(id).subscribe(() => {
        // Success - no response body expected
      });

      const req = httpMock.expectOne(`/api/v2/schedules/${id}`);
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

      const req = httpMock.expectOne(`/api/v2/schedules/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });
});
