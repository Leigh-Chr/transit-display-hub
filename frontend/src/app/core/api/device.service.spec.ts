import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DeviceService } from './device.service';
import { Device, DeviceRegistration, RegisterDeviceRequest } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('DeviceService', () => {
  let service: DeviceService;
  let httpMock: HttpTestingController;

  const mockDevice: Device = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    stopId: 'stop-123',
    stopName: 'Central Station',
    lines: [{ id: 'line-1', code: 'L1', name: 'Line 1', color: '#FF0000' }],
    status: 'OFFLINE',
    lastHeartbeat: undefined
  };

  const mockOnlineDevice: Device = {
    id: '223e4567-e89b-12d3-a456-426614174000',
    stopId: 'stop-456',
    stopName: 'North Station',
    lines: [
      { id: 'line-1', code: 'L1', name: 'Line 1', color: '#FF0000' },
      { id: 'line-2', code: 'L2', name: 'Line 2', color: '#00FF00' }
    ],
    status: 'ONLINE',
    lastHeartbeat: '2024-01-15T10:30:00Z'
  };

  const mockDevices: Device[] = [mockDevice, mockOnlineDevice];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DeviceService
      ]
    });

    service = TestBed.inject(DeviceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('should return all devices without filter', () => {
      service.getAll().subscribe(devices => {
        expect(devices).toEqual(mockDevices);
        expect(devices.length).toBe(2);
      });

      const req = httpMock.expectOne('/api/devices');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('status')).toBe(false);
      req.flush(mockDevices);
    });

    it('should filter by ONLINE status when provided', () => {
      service.getAll('ONLINE').subscribe(devices => {
        expect(devices).toEqual([mockOnlineDevice]);
      });

      const req = httpMock.expectOne('/api/devices?status=ONLINE');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('status')).toBe('ONLINE');
      req.flush([mockOnlineDevice]);
    });

    it('should filter by OFFLINE status when provided', () => {
      service.getAll('OFFLINE').subscribe(devices => {
        expect(devices).toEqual([mockDevice]);
      });

      const req = httpMock.expectOne('/api/devices?status=OFFLINE');
      expect(req.request.params.get('status')).toBe('OFFLINE');
      req.flush([mockDevice]);
    });

    it('should return empty array when no devices', () => {
      service.getAll().subscribe(devices => {
        expect(devices).toEqual([]);
      });

      const req = httpMock.expectOne('/api/devices');
      req.flush([]);
    });
  });

  describe('get', () => {
    it('should return a single device by id', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.get(id).subscribe(device => {
        expect(device).toEqual(mockDevice);
        expect(device.stopName).toBe('Central Station');
      });

      const req = httpMock.expectOne(`/api/devices/${id}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDevice);
    });

    it('should propagate 404 error for non-existent device', () => {
      const id = 'non-existent-id';

      service.get(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/devices/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('register', () => {
    it('should register a new device and return registration with token', () => {
      const request: RegisterDeviceRequest = {
        stopId: 'stop-789'
      };
      const registration: DeviceRegistration = {
        id: '333e4567-e89b-12d3-a456-426614174000',
        token: 'generated-secure-token-base64',
        stopId: 'stop-789',
        stopName: 'South Station'
      };

      service.register(request).subscribe(result => {
        expect(result).toEqual(registration);
        expect(result.token).toBeTruthy();
        expect(result.stopId).toBe('stop-789');
      });

      const req = httpMock.expectOne('/api/devices');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(registration);
    });

    it('should propagate 404 error for non-existent stop', () => {
      const request: RegisterDeviceRequest = {
        stopId: 'non-existent-stop'
      };

      service.register(request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne('/api/devices');
      req.flush({ message: 'Stop not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('update', () => {
    it('should update device stop assignment', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: RegisterDeviceRequest = {
        stopId: 'new-stop-id'
      };
      const updatedDevice: Device = {
        ...mockDevice,
        stopId: 'new-stop-id',
        stopName: 'New Station'
      };

      service.update(id, request).subscribe(device => {
        expect(device).toEqual(updatedDevice);
        expect(device.stopId).toBe('new-stop-id');
      });

      const req = httpMock.expectOne(`/api/devices/${id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);
      req.flush(updatedDevice);
    });

    it('should propagate 404 error for non-existent device', () => {
      const id = 'non-existent-id';
      const request: RegisterDeviceRequest = {
        stopId: 'stop-123'
      };

      service.update(id, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/devices/${id}`);
      req.flush({ message: 'Device not found' }, { status: 404, statusText: 'Not Found' });
    });

    it('should propagate 404 error for non-existent stop', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const request: RegisterDeviceRequest = {
        stopId: 'non-existent-stop'
      };

      service.update(id, request).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/devices/${id}`);
      req.flush({ message: 'Stop not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('delete', () => {
    it('should delete a device', () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      service.delete(id).subscribe(() => {
        // Success - no response body expected
      });

      const req = httpMock.expectOne(`/api/devices/${id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should propagate 404 error for non-existent device', () => {
      const id = 'non-existent-id';

      service.delete(id).subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`/api/devices/${id}`);
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });
});
