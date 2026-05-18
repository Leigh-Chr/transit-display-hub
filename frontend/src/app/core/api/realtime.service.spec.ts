import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RealtimeService } from './realtime.service';
import { RealtimeAlert, VehiclePosition } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let httpMock: HttpTestingController;

  const mockAlert: RealtimeAlert = {
    id: 'alert-1',
    routeIds: ['L1'],
    stopIds: [],
    agencyIds: [],
    headerText: 'Service disruption',
    descriptionText: 'Line L1 suspended between A and B',
    url: null,
    cause: 'TECHNICAL_PROBLEM',
    effect: 'NO_SERVICE',
    severity: 'WARNING'
  };

  const mockVehicle: VehiclePosition = {
    entityId: 'veh-1',
    vehicleId: 'V42',
    vehicleLabel: 'Bus 42',
    tripId: 'trip-1',
    routeId: 'L1',
    latitude: 45.18,
    longitude: 5.72,
    bearing: 90,
    speedMetresPerSecond: 12,
    currentStatus: 'IN_TRANSIT_TO',
    currentStopId: 'stop-1',
    currentStopSequence: 5,
    congestionLevel: null,
    occupancyStatus: 'MANY_SEATS_AVAILABLE',
    occupancyPercentage: 20,
    timestampEpochSeconds: 1_700_000_000,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        RealtimeService
      ]
    });

    service = TestBed.inject(RealtimeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  describe('getAlerts', () => {
    it('should fetch the realtime alerts snapshot', () => {
      service.getAlerts().subscribe(alerts => {
        expect(alerts).toEqual([mockAlert]);
      });

      const req = httpMock.expectOne('/api/admin/realtime/alerts');
      expect(req.request.method).toBe('GET');
      req.flush([mockAlert]);
    });

    it('should surface a network error', () => {
      let errored = false;
      service.getAlerts().subscribe({
        error: () => { errored = true; },
      });

      const req = httpMock.expectOne('/api/admin/realtime/alerts');
      req.error(new ProgressEvent('Network error'));
      expect(errored).toBe(true);
    });
  });

  describe('refreshAlerts', () => {
    it('should POST to the refresh endpoint and return the new snapshot', () => {
      service.refreshAlerts().subscribe(alerts => {
        expect(alerts).toEqual([mockAlert]);
      });

      const req = httpMock.expectOne('/api/admin/realtime/alerts/refresh');
      expect(req.request.method).toBe('POST');
      req.flush([mockAlert]);
    });
  });

  describe('getVehicles', () => {
    it('should fetch the vehicle positions snapshot', () => {
      service.getVehicles().subscribe(vehicles => {
        expect(vehicles).toEqual([mockVehicle]);
      });

      const req = httpMock.expectOne('/api/admin/realtime/vehicles');
      expect(req.request.method).toBe('GET');
      req.flush([mockVehicle]);
    });
  });

  describe('refreshVehicles', () => {
    it('should POST to the refresh endpoint and return the new snapshot', () => {
      service.refreshVehicles().subscribe(vehicles => {
        expect(vehicles).toEqual([mockVehicle]);
      });

      const req = httpMock.expectOne('/api/admin/realtime/vehicles/refresh');
      expect(req.request.method).toBe('POST');
      req.flush([mockVehicle]);
    });
  });
});
