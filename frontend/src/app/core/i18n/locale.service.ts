import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { TRANSLOCO_AVAILABLE_LANGS } from './transloco.providers';

export type SupportedLang = (typeof TRANSLOCO_AVAILABLE_LANGS)[number];

const STORAGE_KEY = 'lang';

/**
 * Single source of truth for the active UI language. Wraps
 * {@link TranslocoService} so the rest of the app can switch
 * languages through a signal API without depending on the lib
 * directly. The choice is persisted in {@code localStorage} so a
 * kiosk redeploy or a refresh keeps the user's last selection.
 *
 * On first load the resolution order is:
 *   1. URL query parameter {@code ?lang=} if present and supported
 *      (handled at navigation time by the consuming components)
 *   2. {@code localStorage[lang]}
 *   3. {@code navigator.language} when its prefix matches a
 *      supported lang
 *   4. Transloco's {@code defaultLang} ('fr')
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly transloco = inject(TranslocoService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly current = signal<SupportedLang>(this.resolveInitial());

  constructor() {
    this.transloco.setActiveLang(this.current());
    // Keep <html lang> aligned with the boot-resolved language too —
    // setLang() only ran on subsequent toggles, so a user whose first
    // visit resolved to fr was stuck with the static index.html "en"
    // until they clicked the language switch.
    if (this.isBrowser) {
      document.documentElement.lang = this.current();
    }
  }

  setLang(lang: SupportedLang): void {
    if (this.current() === lang) {return;}
    this.current.set(lang);
    this.transloco.setActiveLang(lang);
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  }

  toggle(): void {
    this.setLang(this.current() === 'fr' ? 'en' : 'fr');
  }

  private resolveInitial(): SupportedLang {
    if (!this.isBrowser) {
      return 'fr';
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (this.isSupported(stored)) {
      return stored;
    }
    const nav = (navigator.language || '').slice(0, 2);
    if (this.isSupported(nav)) {
      return nav;
    }
    return 'fr';
  }

  private isSupported(value: string | null): value is SupportedLang {
    return value === 'fr' || value === 'en';
  }
}
