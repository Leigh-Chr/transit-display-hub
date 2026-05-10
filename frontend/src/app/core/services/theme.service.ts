import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Global appearance preferences. Three independent toggles:
 *
 *   - {@link isDarkMode}       — dark vs light palette
 *   - {@link isHighContrast}   — accessibility palette with WCAG-AAA
 *                                 contrast ratios, overrides dark/light
 *   - {@link isLargeText}      — boosts every font size by 1.4× via
 *                                 a CSS variable
 *
 * Each is persisted in localStorage and reflected on
 * `document.documentElement` as a class so global CSS can react. The
 * three settings are orthogonal — the kiosk can be in dark + high-
 * contrast + large-text simultaneously, useful at a poorly-lit
 * outdoor stop with a low-vision user.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly isDarkMode = signal(this.loadFlagFromStorage('theme', 'dark', () =>
    this.isBrowser && window.matchMedia('(prefers-color-scheme: dark)').matches,
  ));

  readonly isHighContrast = signal(this.loadFlagFromStorage('contrast', 'high', () =>
    this.isBrowser && window.matchMedia('(prefers-contrast: more)').matches,
  ));

  readonly isLargeText = signal(this.loadFlagFromStorage('largeText', 'on', () => false));

  constructor() {
    effect(() => {
      if (!this.isBrowser) {
        return;
      }
      const isDark = this.isDarkMode();
      const isHighContrast = this.isHighContrast();
      const isLargeText = this.isLargeText();
      document.documentElement.classList.toggle('dark-theme', isDark);
      document.documentElement.classList.toggle('high-contrast-theme', isHighContrast);
      document.documentElement.classList.toggle('large-text-theme', isLargeText);
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      localStorage.setItem('contrast', isHighContrast ? 'high' : 'normal');
      localStorage.setItem('largeText', isLargeText ? 'on' : 'off');
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update((current) => !current);
  }

  toggleHighContrast(): void {
    this.isHighContrast.update((current) => !current);
  }

  toggleLargeText(): void {
    this.isLargeText.update((current) => !current);
  }

  /** Reads a boolean flag persisted in localStorage. Returns the
   *  fallback (typically a media-query lookup) when nothing is stored
   *  yet so the very first render respects user agent preferences. */
  private loadFlagFromStorage(
    key: string,
    truthyValue: string,
    fallback: () => boolean,
  ): boolean {
    if (!this.isBrowser) {
      return false;
    }
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      return stored === truthyValue;
    }
    return fallback();
  }
}
