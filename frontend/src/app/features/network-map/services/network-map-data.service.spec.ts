import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NetworkMapDataService } from './network-map-data.service';
import { FlexLocation, NetworkMap, NetworkMapAlerts } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('NetworkMapDataService', () => {
  let service: NetworkMapDataService;
  let httpMock: HttpTestingController;

  const mockNetworkMap: NetworkMap = {
    lines: [
      {
        id: 'line-1',
        code: 'M1',
        name: 'Metro 1',
        color: '#FF0000',
        type: 'METRO',
        itineraries: [['stop-1', 'stop-2']],
      },
    ],
    stops: [
      { id: 'stop-1', name: 'Station A', latitude: 48.85, longitude: 2.35, schematicX: null, schematicY: null, lineCodes: ['M1'] },
      { id: 'stop-2', name: 'Station B', latitude: 48.86, longitude: 2.36, schematicX: null, schematicY: null, lineCodes: ['M1'] },
    ],
    bounds: { minX: 2.35, minY: 48.85, maxX: 2.36, maxY: 48.86 },
  };

  const mockAlerts: NetworkMapAlerts = {
    networkAlerts: [{ title: 'Strike', content: 'Service disrupted', severity: 'WARNING' }],
    lineAlerts: { 'line-1': [{ title: 'Delay', content: '5 min delay', severity: 'INFO' }] },
    stopAlerts: {},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NetworkMapDataService,
      ],
    });

    service = TestBed.inject(NetworkMapDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getNetworkMap', () => {
    it('should call GET /api/network-map', () => {
      service.getNetworkMap().subscribe(map => {
        expect(map).toEqual(mockNetworkMap);
        expect(map.lines).toHaveLength(1);
        expect(map.stops).toHaveLength(2);
      });

      const req = httpMock.expectOne('/api/network-map');
      expect(req.request.method).toBe('GET');
      req.flush(mockNetworkMap);
    });

    it('should propagate HTTP errors', () => {
      service.getNetworkMap().subscribe({
        error: (err) => {
          expect(err.status).toBe(500);
        },
      });

      const req = httpMock.expectOne('/api/network-map');
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getAlerts', () => {
    it('should call GET /api/network-map/alerts', () => {
      service.getAlerts().subscribe(alerts => {
        expect(alerts).toEqual(mockAlerts);
        expect(alerts.networkAlerts).toHaveLength(1);
      });

      const req = httpMock.expectOne('/api/network-map/alerts');
      expect(req.request.method).toBe('GET');
      req.flush(mockAlerts);
    });

    it('should propagate HTTP errors', () => {
      service.getAlerts().subscribe({
        error: (err) => {
          expect(err.status).toBe(500);
        },
      });

      const req = httpMock.expectOne('/api/network-map/alerts');
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getStopTadZone', () => {
    const mockZone: FlexLocation = {
      id: 'loc-1',
      externalId: 'FLEX_NORTH',
      stopExternalId: 'EXT_STOP_1',
      name: 'Zone Nord',
      geometryType: 'Polygon',
      geometryJson: '{"type":"Polygon","coordinates":[]}',
      minLongitude: 5.70, maxLongitude: 5.75,
      minLatitude: 45.18, maxLatitude: 45.20,
    };

    it('returns the zone when the API responds 200', () => {
      service.getStopTadZone('stop-1').subscribe(zone => {
        expect(zone).toEqual(mockZone);
      });
      const req = httpMock.expectOne('/api/network-map/stops/stop-1/tad-zone');
      expect(req.request.method).toBe('GET');
      req.flush(mockZone);
    });

    it('falls back to null on 404 (no zone bound to this stop)', () => {
      service.getStopTadZone('stop-no-zone').subscribe(zone => {
        expect(zone).toBeNull();
      });
      const req = httpMock.expectOne('/api/network-map/stops/stop-no-zone/tad-zone');
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    });

    it('falls back to null on any other error rather than propagating', () => {
      service.getStopTadZone('stop-err').subscribe(zone => {
        expect(zone).toBeNull();
      });
      const req = httpMock.expectOne('/api/network-map/stops/stop-err/tad-zone');
      req.flush('Boom', { status: 500, statusText: 'Internal Server Error' });
    });
  });
});
