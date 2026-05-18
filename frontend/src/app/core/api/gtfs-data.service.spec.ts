import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { GtfsDataService } from './gtfs-data.service';
import {
  BookingRule,
  FareAttribute,
  FareLegJoinRule,
  FaresV2,
  ImportAudit,
  Pathway,
  Shape,
  Translation,
} from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('GtfsDataService', () => {
  let service: GtfsDataService;
  let httpMock: HttpTestingController;

  const mockFare: FareAttribute = {
    id: 'fare-1',
    externalId: 'std',
    price: '1.60',
    currency: 'EUR',
    paymentMethod: 'BEFORE_BOARDING',
    transfers: 1,
    transferDuration: 3600,
    agencyId: 'a1',
    agencyName: 'Acme',
    rules: [],
  };

  const mockBookingRule: BookingRule = {
    id: 'br-1',
    externalId: 'br-ext',
    bookingType: 'PRIOR_DAYS',
    priorNoticeDurationMin: 60,
    priorNoticeDurationMax: 1440,
    priorNoticeLastDay: 1,
    priorNoticeLastTime: '17:00:00',
    priorNoticeStartDay: 14,
    phone: '0800-000',
    bookingUrl: null,
    infoUrl: null,
    message: null,
  };

  const mockLegJoin: FareLegJoinRule = {
    id: 'lj-1',
    fromNetworkId: null,
    toNetworkId: null,
    fromStopName: null,
    toStopName: null,
  };

  const mockFaresV2: FaresV2 = {
    areas: [],
    timeframes: [],
    products: [],
    legRules: [],
    transferRules: [],
    networks: [],
    fareMedia: [],
    legJoinRules: [mockLegJoin],
  };

  const mockTranslation: Translation = {
    id: 't-1',
    tableName: 'stops',
    recordId: 'stop-1',
    fieldValue: null,
    fieldName: 'stop_name',
    language: 'en',
    translation: 'Central Station',
  };

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

  const mockPathway: Pathway = {
    id: 'pw-1',
    externalId: 'pw-ext-1',
    fromStopId: 's1',
    fromStopName: 'A',
    toStopId: 's2',
    toStopName: 'B',
    pathwayMode: 'WALKWAY',
    bidirectional: true,
    lengthMetres: 25,
    traversalTimeSeconds: 30,
    stairCount: null,
    maxSlope: null,
    minWidthMetres: null,
    signpostedAs: null,
    reversedSignpostedAs: null,
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
  describe('getFares', () => {
    it('should fetch the fares list', () => {
      service.getFares().subscribe(fares => {
        expect(fares).toEqual([mockFare]);
      });

      const req = httpMock.expectOne('/api/admin/fares');
      expect(req.request.method).toBe('GET');
      req.flush([mockFare]);
    });

    it('should surface a network error', () => {
      let errored = false;
      service.getFares().subscribe({ error: () => { errored = true; } });

      const req = httpMock.expectOne('/api/admin/fares');
      req.error(new ProgressEvent('Network error'));
      expect(errored).toBe(true);
    });
  });

  describe('getBookingRules', () => {
    it('should fetch the booking-rules list', () => {
      service.getBookingRules().subscribe(rules => {
        expect(rules).toEqual([mockBookingRule]);
      });

      const req = httpMock.expectOne('/api/admin/booking-rules');
      expect(req.request.method).toBe('GET');
      req.flush([mockBookingRule]);
    });
  });

  describe('getFaresV2', () => {
    it('should fetch the aggregated fares-v2 payload', () => {
      service.getFaresV2().subscribe(payload => {
        expect(payload).toEqual(mockFaresV2);
      });

      const req = httpMock.expectOne('/api/admin/fares-v2');
      expect(req.request.method).toBe('GET');
      req.flush(mockFaresV2);
    });
  });

  describe('getTranslations', () => {
    it('should pass the lang query param', () => {
      service.getTranslations('en').subscribe(rows => {
        expect(rows).toEqual([mockTranslation]);
      });

      const req = httpMock.expectOne(r => r.url === '/api/admin/translations' && r.params.get('lang') === 'en');
      expect(req.request.params.has('table')).toBe(false);
      req.flush([mockTranslation]);
    });

    it('should append the table filter when provided', () => {
      service.getTranslations('en', 'stops').subscribe();

      const req = httpMock.expectOne(r =>
        r.url === '/api/admin/translations'
        && r.params.get('lang') === 'en'
        && r.params.get('table') === 'stops',
      );
      req.flush([]);
    });
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

  describe('getPathwaysForStop', () => {
    it('should hit the per-stop pathways endpoint', () => {
      service.getPathwaysForStop('stop-1').subscribe(rows => {
        expect(rows).toEqual([mockPathway]);
      });

      const req = httpMock.expectOne('/api/stops/stop-1/pathways');
      expect(req.request.method).toBe('GET');
      req.flush([mockPathway]);
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
