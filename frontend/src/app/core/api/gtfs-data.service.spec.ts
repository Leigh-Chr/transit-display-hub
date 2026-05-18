import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { GtfsDataService } from './gtfs-data.service';
import { ImportAudit, Shape } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('GtfsDataService', () => {
  let service: GtfsDataService;
  let httpMock: HttpTestingController;

  const mockImportAudit: ImportAudit = {
    id: 'ia-1',
    sourceUrl: 'https://example.com/gtfs.zip',
    sourceHash: 'abc',
    startedAt: '2026-05-01T10:00:00Z',
    completedAt: '2026-05-01T10:01:00Z',
    durationMs: 60000,
    linesCount: 10,
    stopsCount: 100,
    itinerariesCount: 30,
    schedulesCount: 1000,
    status: 'SUCCESS',
    errorMessage: null,
    triggeredBy: 'admin',
    validationStatus: 'SUCCESS',
    validationNoticeErrors: 0,
    validationNoticeWarnings: 2,
  };


  const mockShape: Shape = {
    id: 'sh-1',
    externalId: 'sh-ext-1',
    points: [
      { latitude: 45.18, longitude: 5.72, distTraveled: 0 },
      { latitude: 45.19, longitude: 5.73, distTraveled: 1500 },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        GtfsDataService
      ]
    });

    service = TestBed.inject(GtfsDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  describe('getImportAudit', () => {
    it('should pass the default limit of 50', () => {
      service.getImportAudit().subscribe(rows => {
        expect(rows).toEqual([mockImportAudit]);
      });

      const req = httpMock.expectOne(r => r.url === '/api/admin/import-audit' && r.params.get('limit') === '50');
      req.flush([mockImportAudit]);
    });

    it('should honour a custom limit', () => {
      service.getImportAudit(10).subscribe();

      const req = httpMock.expectOne(r => r.url === '/api/admin/import-audit' && r.params.get('limit') === '10');
      req.flush([]);
    });
  });

  describe('getShapeForItinerary', () => {
    it('should hit the per-itinerary shape endpoint', () => {
      service.getShapeForItinerary('it-1').subscribe(shape => {
        expect(shape).toEqual(mockShape);
      });

      const req = httpMock.expectOne('/api/itineraries/it-1/shape');
      expect(req.request.method).toBe('GET');
      req.flush(mockShape);
    });

    it('should propagate a 404 when the itinerary has no shape', () => {
      let errStatus: number | undefined;
      service.getShapeForItinerary('it-2').subscribe({
        error: (err) => { errStatus = err.status; },
      });

      const req = httpMock.expectOne('/api/itineraries/it-2/shape');
      req.flush({ message: 'No shape' }, { status: 404, statusText: 'Not Found' });
      expect(errStatus).toBe(404);
    });
  });
});
