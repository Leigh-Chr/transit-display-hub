import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DashboardService, DashboardSummary } from './dashboard.service';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  const mockSummary: DashboardSummary = {
    lineCount: 5,
    stopCount: 42,
    itineraryCount: 10,
    topLines: [],
    activeMessages: [],
    recentMessages: [],
    devices: {
      total: 7,
      online: 4,
      offline: 3,
      offlinePreview: []
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DashboardService
      ]
    });

    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  describe('getSummary', () => {
    it('should fetch the admin dashboard summary', () => {
      service.getSummary().subscribe(summary => {
        expect(summary).toEqual(mockSummary);
        expect(summary.lineCount).toBe(5);
      });

      const req = httpMock.expectOne('/api/admin/dashboard');
      expect(req.request.method).toBe('GET');
      req.flush(mockSummary);
    });

    it('should surface a network error', () => {
      let errored = false;
      service.getSummary().subscribe({
        error: () => { errored = true; },
      });

      const req = httpMock.expectOne('/api/admin/dashboard');
      req.error(new ProgressEvent('Network error'));
      expect(errored).toBe(true);
    });
  });
});
