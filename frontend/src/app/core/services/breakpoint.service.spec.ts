import { TestBed } from '@angular/core/testing';
import { BreakpointService } from './breakpoint.service';
import { BreakpointObserver } from '@angular/cdk/layout';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

describe('BreakpointService', () => {
  let service: BreakpointService;
  let mockBreakpointObserver: { observe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockBreakpointObserver = {
      observe: vi.fn().mockReturnValue(of({
        matches: false,
        breakpoints: {}
      }))
    };

    TestBed.configureTestingModule({
      providers: [
        BreakpointService,
        { provide: BreakpointObserver, useValue: mockBreakpointObserver }
      ]
    });

    service = TestBed.inject(BreakpointService);
  });
  describe('signals', () => {
    it('should have isMobile signal with initial value', () => {
      expect(service.isMobile()).toBeDefined();
      expect(typeof service.isMobile()).toBe('boolean');
    });

    it('should have isSmallScreen signal with initial value', () => {
      expect(service.isSmallScreen()).toBeDefined();
      expect(typeof service.isSmallScreen()).toBe('boolean');
    });
  });

  describe('default values', () => {
    it('should default isMobile to false', () => {
      expect(service.isMobile()).toBe(false);
    });

    it('should default isSmallScreen to false', () => {
      expect(service.isSmallScreen()).toBe(false);
    });
  });

  describe('observe calls', () => {
    it('should call breakpointObserver.observe for each signal', () => {
      // The service constructor calls observe for each signal definition
      expect(mockBreakpointObserver.observe).toHaveBeenCalled();
      // 2 signals: isMobile, isSmallScreen
      expect(mockBreakpointObserver.observe.mock.calls.length).toBe(2);
    });
  });
});
