import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FareCalculatorService } from './fare-calculator.service';
import { FareCalculationResult } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('FareCalculatorService', () => {
  let service: FareCalculatorService;
  let httpMock: HttpTestingController;

  const mockResult: FareCalculationResult = {
    fromStopId: 'A',
    fromStopName: 'Station A',
    fromZoneId: 'Z1',
    toStopId: 'B',
    toStopName: 'Station B',
    toZoneId: 'Z2',
    v1: [
      {
        fareId: 'standard',
        price: 1.6,
        currency: 'EUR',
        paymentMethod: 'BEFORE_BOARDING',
        transfers: 1,
        transferDurationSeconds: 3600,
        agencyName: 'Acme',
        matchedRoute: null,
        matchedOriginZone: 'Z1',
        matchedDestinationZone: 'Z2',
      },
    ],
    v2: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FareCalculatorService
      ]
    });

    service = TestBed.inject(FareCalculatorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  describe('calculate', () => {
    it('should query the backend with the from/to stop ids', () => {
      service.calculate('A', 'B').subscribe(result => {
        expect(result).toEqual(mockResult);
        expect(result?.v1[0]?.price).toBe(1.6);
      });

      const req = httpMock.expectOne('/api/fares/calculate?from=A&to=B');
      expect(req.request.method).toBe('GET');
      req.flush(mockResult);
    });

    it('should swallow errors and emit null (catchError fallback)', () => {
      let value: FareCalculationResult | null | undefined;
      service.calculate('A', 'B').subscribe(v => { value = v; });

      const req = httpMock.expectOne('/api/fares/calculate?from=A&to=B');
      req.error(new ProgressEvent('Network error'));
      expect(value).toBeNull();
    });
  });
});
