import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(
      'dark-theme', 'high-contrast-theme', 'large-text-theme',
    );

    // Mock matchMedia (happy-dom may not define it natively)
    (window as unknown as { matchMedia: (query: string) => Partial<MediaQueryList> }).matchMedia =
      vi.fn().mockReturnValue({ matches: false });

    TestBed.configureTestingModule({
      providers: [ThemeService]
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('isDarkMode signal', () => {
    it('should default to false when no stored preference and system prefers light', () => {
      expect(service.isDarkMode()).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from false to true', () => {
      expect(service.isDarkMode()).toBe(false);

      service.toggleTheme();

      expect(service.isDarkMode()).toBe(true);
    });

    it('should toggle back from true to false', () => {
      service.toggleTheme(); // false -> true
      service.toggleTheme(); // true -> false

      expect(service.isDarkMode()).toBe(false);
    });

    it('should persist theme to localStorage after toggle', () => {
      service.toggleTheme(); // false -> true
      // Effect runs synchronously in test with TestBed
      TestBed.tick();

      expect(localStorage.getItem('theme')).toBe('dark');

      service.toggleTheme(); // true -> false
      TestBed.tick();

      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('should update document class on toggle', () => {
      service.toggleTheme(); // false -> true
      TestBed.tick();

      expect(document.documentElement.classList.contains('dark-theme')).toBe(true);

      service.toggleTheme(); // true -> false
      TestBed.tick();

      expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    });
  });

  describe('isHighContrast signal', () => {
    it('should default to false when no stored preference and prefers-contrast: more is not set', () => {
      expect(service.isHighContrast()).toBe(false);
    });

    it('should toggle and apply the high-contrast-theme class on the document', () => {
      service.toggleHighContrast();
      TestBed.tick();

      expect(service.isHighContrast()).toBe(true);
      expect(document.documentElement.classList.contains('high-contrast-theme')).toBe(true);
      expect(localStorage.getItem('contrast')).toBe('high');

      service.toggleHighContrast();
      TestBed.tick();

      expect(service.isHighContrast()).toBe(false);
      expect(document.documentElement.classList.contains('high-contrast-theme')).toBe(false);
      expect(localStorage.getItem('contrast')).toBe('normal');
    });
  });

  describe('isLargeText signal', () => {
    it('should default to false when no stored preference', () => {
      expect(service.isLargeText()).toBe(false);
    });

    it('should toggle and apply the large-text-theme class', () => {
      service.toggleLargeText();
      TestBed.tick();

      expect(service.isLargeText()).toBe(true);
      expect(document.documentElement.classList.contains('large-text-theme')).toBe(true);
      expect(localStorage.getItem('largeText')).toBe('on');
    });
  });
});

describe('ThemeService with dark localStorage', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('theme', 'dark');

    TestBed.configureTestingModule({
      providers: [ThemeService]
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should load dark mode from localStorage', () => {
    expect(service.isDarkMode()).toBe(true);
  });

  it('should toggle from dark to light', () => {
    service.toggleTheme();
    expect(service.isDarkMode()).toBe(false);
  });
});

describe('ThemeService with light localStorage', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('theme', 'light');

    TestBed.configureTestingModule({
      providers: [ThemeService]
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should load light mode from localStorage', () => {
    expect(service.isDarkMode()).toBe(false);
  });
});

describe('ThemeService with system dark preference', () => {
  let service: ThemeService;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    localStorage.clear();

    // Save and replace matchMedia
    originalMatchMedia = window.matchMedia;
    (window as unknown as { matchMedia: (query: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => { /* noop mock */ },
      removeEventListener: () => { /* noop mock */ },
      addListener: () => { /* noop mock */ },
      removeListener: () => { /* noop mock */ },
      dispatchEvent: () => false,
      onchange: null,
    }) as MediaQueryList;

    TestBed.configureTestingModule({
      providers: [ThemeService]
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    (window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = originalMatchMedia;
  });

  it('should fall back to system dark preference', () => {
    expect(service.isDarkMode()).toBe(true);
  });
});
