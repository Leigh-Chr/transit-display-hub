import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { GtfsDataService } from './gtfs-data.service';
import { ImportAudit } from '@shared/models';
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
});
