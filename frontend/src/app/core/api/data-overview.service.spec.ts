import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DataOverviewService } from './data-overview.service';
import { DataOverview } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('DataOverviewService', () => {
  let service: DataOverviewService;
  let httpMock: HttpTestingController;

  const mockOverview: DataOverview = {
    staticGtfs: {
      agencies: 1,
      lines: 12,
      stops: 256,
      disabledStops: 3,
      itineraries: 30,
      itineraryStops: 800,
      schedules: 2000,
      serviceCalendars: 4,
      transfers: 5,
      shapes: 25,
      pathways: 0,
      stationLevels: 0,
      fareAttributes: 2,
      locationGroups: 0,
      bookingRules: 0,
      translations: 50,
      attributions: 1,
    },
    realtime: {
      alerts: 0,
      tripUpdates: 100,
      vehiclePositions: 35,
      alertsEnabled: true,
      tripUpdatesEnabled: true,
      vehiclePositionsEnabled: false,
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DataOverviewService
      ]
    });

    service = TestBed.inject(DataOverviewService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  describe('getOverview', () => {
    it('should fetch the admin data-overview snapshot', () => {
      service.getOverview().subscribe(overview => {
        expect(overview).toEqual(mockOverview);
        expect(overview.staticGtfs.stops).toBe(256);
      });

      const req = httpMock.expectOne('/api/admin/data-overview');
      expect(req.request.method).toBe('GET');
      req.flush(mockOverview);
    });

    it('should surface a network error', () => {
      let errored = false;
      service.getOverview().subscribe({
        error: () => { errored = true; },
      });

      const req = httpMock.expectOne('/api/admin/data-overview');
      req.error(new ProgressEvent('Network error'));
      expect(errored).toBe(true);
    });
  });
});
