import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FlexStopTimeService } from './flex-stop-time.service';
import { FlexStopTime } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('FlexStopTimeService', () => {
  let service: FlexStopTimeService;
  let httpMock: HttpTestingController;

  const mockRow: FlexStopTime = {
    id: 'fst-1',
    itineraryId: 'it-1',
    itineraryName: 'Line A → B',
    lineCode: 'L1',
    lineColor: '#FF5733',
    stopSequence: 1,
    stopId: 'stop-1',
    stopName: 'Stop 1',
    locationExternalId: null,
    locationName: null,
    locationGroupExternalId: null,
    locationGroupName: null,
    startPickupDropOffWindow: '08:00:00',
    endPickupDropOffWindow: '20:00:00',
    pickupType: 2,
    dropOffType: 2,
    pickupBookingRuleId: 'br-1',
    pickupBookingRuleExternalId: 'br-ext-1',
    dropOffBookingRuleId: null,
    dropOffBookingRuleExternalId: null,
    serviceCalendarId: 'sc-1',
    serviceCalendarExternalId: 'sc-ext-1',
    stopHeadsign: 'Town centre',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FlexStopTimeService
      ]
    });

    service = TestBed.inject(FlexStopTimeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  describe('browse', () => {
    it('should fetch the admin flex stop_times list', () => {
      service.browse().subscribe(rows => {
        expect(rows).toEqual([mockRow]);
      });

      const req = httpMock.expectOne('/api/admin/flex-stop-times');
      expect(req.request.method).toBe('GET');
      req.flush([mockRow]);
    });

    it('should fall back to an empty array on error (catchError)', () => {
      let value: FlexStopTime[] | undefined;
      service.browse().subscribe(rows => { value = rows; });

      const req = httpMock.expectOne('/api/admin/flex-stop-times');
      req.error(new ProgressEvent('Network error'));
      expect(value).toEqual([]);
    });
  });

  describe('getWindowsForLocation', () => {
    it('should fetch windows without a date param when omitted', () => {
      service.getWindowsForLocation('loc-abc').subscribe(rows => {
        expect(rows).toEqual([mockRow]);
      });

      const req = httpMock.expectOne('/api/network-map/locations/loc-abc/flex-windows');
      expect(req.request.method).toBe('GET');
      req.flush([mockRow]);
    });

    it('should append the date query param when provided', () => {
      service.getWindowsForLocation('loc-abc', '2026-05-15').subscribe(rows => {
        expect(rows).toEqual([mockRow]);
      });

      const req = httpMock.expectOne('/api/network-map/locations/loc-abc/flex-windows?date=2026-05-15');
      expect(req.request.method).toBe('GET');
      req.flush([mockRow]);
    });

    it('should url-encode the external id', () => {
      service.getWindowsForLocation('loc with spaces').subscribe();
      const req = httpMock.expectOne('/api/network-map/locations/loc%20with%20spaces/flex-windows');
      req.flush([]);
    });

    it('should fall back to an empty array on error (catchError)', () => {
      let value: FlexStopTime[] | undefined;
      service.getWindowsForLocation('loc-abc').subscribe(rows => { value = rows; });

      const req = httpMock.expectOne('/api/network-map/locations/loc-abc/flex-windows');
      req.error(new ProgressEvent('Network error'));
      expect(value).toEqual([]);
    });
  });
});
