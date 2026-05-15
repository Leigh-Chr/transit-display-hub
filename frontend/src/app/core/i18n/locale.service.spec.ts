import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocaleService } from './locale.service';

describe('LocaleService', () => {
  let service: LocaleService;
  let transloco: TranslocoService;

  beforeEach(() => {
    // Seed localStorage so resolveInitial() lands on a deterministic
    // starting language regardless of happy-dom's navigator.language.
    localStorage.setItem('lang', 'fr');
    document.documentElement.lang = 'fr';

    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en: {}, fr: { hello: 'Bonjour' } },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'fr' },
          preloadLangs: true,
        }),
      ],
    });

    transloco = TestBed.inject(TranslocoService);
    service = TestBed.inject(LocaleService);
  });

  afterEach(() => {
    localStorage.removeItem('lang');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('setLang', () => {
    it('should update the active transloco lang', () => {
      service.setLang('en');
      expect(transloco.getActiveLang()).toBe('en');
      expect(service.current()).toBe('en');
    });

    it('should update the <html lang> attribute', () => {
      service.setLang('en');
      expect(document.documentElement.lang).toBe('en');
      service.setLang('fr');
      expect(document.documentElement.lang).toBe('fr');
    });

    it('should persist the choice in localStorage', () => {
      service.setLang('en');
      expect(localStorage.getItem('lang')).toBe('en');
    });

    it('should be a no-op when the lang is already active', () => {
      service.setLang('en');
      // Mutate localStorage to a sentinel; a second setLang('en') call
      // must not rewrite it because current() already equals 'en'.
      localStorage.setItem('lang', 'sentinel');
      service.setLang('en');
      expect(localStorage.getItem('lang')).toBe('sentinel');
    });
  });

  describe('toggle', () => {
    it('should flip fr → en', () => {
      service.setLang('fr');
      service.toggle();
      expect(service.current()).toBe('en');
    });

    it('should flip en → fr', () => {
      service.setLang('en');
      service.toggle();
      expect(service.current()).toBe('fr');
    });
  });
});
