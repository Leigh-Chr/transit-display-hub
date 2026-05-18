import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AttributionService } from './attribution.service';
import { Attribution } from '@shared/models';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AttributionService', () => {
  let service: AttributionService;
  let httpMock: HttpTestingController;

  const mockAttributions: Attribution[] = [
    {
      organizationName: 'Acme Transit Authority',
      producer: true,
      operator: false,
      authority: true,
      url: 'https://example.com',
      email: 'contact@example.com',
      phone: null,
    },
    {
      organizationName: 'Acme Operations',
      producer: false,
      operator: true,
      authority: false,
      url: null,
      email: null,
      phone: '+33-1-23-45-67-89',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AttributionService
      ]
    });

    service = TestBed.inject(AttributionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  describe('getAllAttributions', () => {
    it('should fetch the public attribution list', () => {
      service.getAllAttributions().subscribe(list => {
        expect(list).toEqual(mockAttributions);
        expect(list.length).toBe(2);
      });

      const req = httpMock.expectOne('/api/attributions');
      expect(req.request.method).toBe('GET');
      req.flush(mockAttributions);
    });

    it('should surface a network error', () => {
      let errored = false;
      service.getAllAttributions().subscribe({
        error: () => { errored = true; },
      });

      const req = httpMock.expectOne('/api/attributions');
      req.error(new ProgressEvent('Network error'));
      expect(errored).toBe(true);
    });
  });
});
