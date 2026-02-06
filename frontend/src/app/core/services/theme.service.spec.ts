import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-theme');

    // Stub matchMedia if not present (happy-dom may not define it)
    if (!window.matchMedia) {
      (window as any).matchMedia = () => ({ matches: false });
    } else {
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: false
      } as MediaQueryList);
    }

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
      TestBed.flushEffects();

      expect(localStorage.getItem('theme')).toBe('dark');

      service.toggleTheme(); // true -> false
      TestBed.flushEffects();

      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('should update document class on toggle', () => {
      service.toggleTheme(); // false -> true
      TestBed.flushEffects();

      expect(document.documentElement.classList.contains('dark-theme')).toBe(true);

      service.toggleTheme(); // true -> false
      TestBed.flushEffects();

      expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
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
    (window as any).matchMedia = (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    });

    TestBed.configureTestingModule({
      providers: [ThemeService]
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
    (window as any).matchMedia = originalMatchMedia;
  });

  it('should fall back to system dark preference', () => {
    expect(service.isDarkMode()).toBe(true);
  });
});
