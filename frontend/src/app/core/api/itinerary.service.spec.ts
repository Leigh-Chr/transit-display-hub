import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ItineraryService } from './itinerary.service';
import { Itinerary, CreateItineraryRequest, UpdateItineraryStopsRequest, AddItineraryStopRequest, PageResponse } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ItineraryService', () => {
  let service: ItineraryService;
  let httpMock: HttpTestingController;

  const mockItinerary: Itinerary = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Direction North',
    terminusName: 'North Station',
    line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' },
    stops: [
      { id: 'stop1', name: 'Central Station', position: 0 },
      { id: 'stop2', name: 'North Station', position: 1 }
    ]
  };

  const mockItineraries: Itinerary[] = [
    mockItinerary,
    {
      id: '223e4567-e89b-12d3-a456-426614174000',
      name: 'Direction South',
      terminusName: 'South Station',
      line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' },
      stops: []
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ItineraryService
      ]
    });

    service = TestBed.inject(ItineraryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('should return all itineraries without lineId', () => {
      service.getAll().subscribe(itineraries => {
        expect(itineraries).toEqual(mockItineraries);
      });

      const req = httpMock.expectOne('/api/itineraries');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('lineId')).toBe(false);
      req.flush(mockItineraries);
    });

    it('should filter by lineId when provided', () => {
      const lineId = 'line-123';

      service.getAll(lineId).subscribe(itineraries => {
        expect(itineraries).toEqual([mockItinerary]);
      });

      const req = httpMock.expectOne(r =>
        r.url === '/api/itineraries' && r.params.get('lineId') === lineId
      );
      expect(req.request.method).toBe('GET');
      req.flush([mockItinerary]);
    });
  });

  describe('getAllPaginated', () => {
    const mockPageResponse: PageResponse<Itinerary> = {
      content: mockItineraries,
      page: 0,
      size: 10,
      totalElements: 2,
      totalPages: 1,
      first: true,
      last: true
    };

    it('should send all pagination params including lineId', () => {
      service.getAllPaginated({
        page: 1, size: 20, sortBy: 'name', sortDir: 'desc', search: 'north', lineId: 'line-123'
      }).subscribe(response => {
        expect(response).toEqual(mockPageResponse);
      });

      const req = httpMock.expectOne(r =>
        r.url === '/api/itineraries' &&
        r.params.get('page') === '1' &&
        r.params.get('size') === '20' &&
        r.params.get('sortBy') === 'name' &&
        r.params.get('sortDir') === 'desc' &&
        r.params.get('search') === 'north' &&
        r.params.get('lineId') === 'line-123'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockPageResponse);
    });

    it('should use default page 0 when no params provided', () => {
      service.getAllPaginated().subscribe();

      const req = httpMock.expectOne(r =>
        r.url === '/api/itineraries' && r.params.get('page') === '0'
      );
      req.flush(mockPageResponse);
    });
  });

  describe('get', () => {
    it('should return a single itinerary by id', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.get(id).subscribe(itinerary => {
        expect(itinerary).toEqual(mockItinerary);
      });

      const req = httpMock.expectOne(`/api/itineraries/${id}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockItinerary);
    });
  });

  describe('create', () => {
    it('should create a new itinerary', () => {
      const request: CreateItineraryRequest = {
        lineId: 'line-123',
        name: 'New Itinerary'
      };

      service.create(request).subscribe(itinerary => {
        expect(itinerary).toEqual(mockItinerary);
      });

      const req = httpMock.expectOne('/api/itineraries');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockItinerary);
    });
  });

  describe('update', () => {
    it('should update an existing itinerary', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: CreateItineraryRequest = {
        lineId: 'line-123',
        name: 'Updated Name'
      };

      service.update(id, request).subscribe(itinerary => {
        expect(itinerary).toEqual(mockItinerary);
      });

      const req = httpMock.expectOne(`/api/itineraries/${id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(mockItinerary);
    });
  });

  describe('delete', () => {
    it('should delete an itinerary', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.delete(id).subscribe();

      const req = httpMock.expectOne(`/api/itineraries/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('updateStops', () => {
    it('should replace stops on itinerary', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: UpdateItineraryStopsRequest = {
        stopIds: ['stop-1', 'stop-2']
      };

      service.updateStops(id, request).subscribe(itinerary => {
        expect(itinerary).toEqual(mockItinerary);
      });

      const req = httpMock.expectOne(`/api/itineraries/${id}/stops`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(mockItinerary);
    });
  });

  describe('addStop', () => {
    it('should add a stop to itinerary', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: AddItineraryStopRequest = {
        stopId: 'stop-3',
        position: 2
      };

      service.addStop(id, request).subscribe(itinerary => {
        expect(itinerary).toEqual(mockItinerary);
      });

      const req = httpMock.expectOne(`/api/itineraries/${id}/stops`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockItinerary);
    });
  });

  describe('removeStop', () => {
    it('should remove a stop from itinerary', () => {
      const itineraryId = '123e4567-e89b-12d3-a456-426614174000';
      const stopId = 'stop-1';

      service.removeStop(itineraryId, stopId).subscribe(itinerary => {
        expect(itinerary).toEqual(mockItinerary);
      });

      const req = httpMock.expectOne(`/api/itineraries/${itineraryId}/stops/${stopId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(mockItinerary);
    });
  });
});
