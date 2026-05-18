import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FeedInfoService } from './feed-info.service';
import { FeedInfo } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('FeedInfoService', () => {
  let service: FeedInfoService;
  let httpMock: HttpTestingController;

  const mockFeedInfo: FeedInfo = {
    publisherName: 'Acme Transit',
    publisherUrl: 'https://example.com',
    lang: 'fr',
    defaultLang: 'fr',
    feedVersion: '2026-05-01',
    contactEmail: 'feed@example.com',
    contactUrl: null,
    startDate: '2026-05-01',
    endDate: '2026-06-30',
    sourceUrl: 'https://example.com/gtfs.zip',
    sourceHash: 'abc123',
    importedAt: '2026-05-01T10:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FeedInfoService
      ]
    });

    service = TestBed.inject(FeedInfoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  describe('getFeedInfo', () => {
    it('should return the imported feed info on 200', () => {
      service.getFeedInfo().subscribe(info => {
        expect(info).toEqual(mockFeedInfo);
      });

      const req = httpMock.expectOne('/api/admin/feed-info');
      expect(req.request.method).toBe('GET');
      req.flush(mockFeedInfo);
    });

    it('should map a 204 response to null', () => {
      service.getFeedInfo().subscribe(info => {
        expect(info).toBeNull();
      });

      const req = httpMock.expectOne('/api/admin/feed-info');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('should surface a network error', () => {
      let errored = false;
      service.getFeedInfo().subscribe({
        error: () => { errored = true; },
      });

      const req = httpMock.expectOne('/api/admin/feed-info');
      req.error(new ProgressEvent('Network error'));
      expect(errored).toBe(true);
    });
  });
});
