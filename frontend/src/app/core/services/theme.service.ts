import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly isDarkMode = signal(this.loadFromStorage());

  constructor() {
    effect(() => {
      if (this.isBrowser) {
        const isDark = this.isDarkMode();
        document.documentElement.classList.toggle('dark-theme', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
      }
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update((current) => !current);
  }

  private loadFromStorage(): boolean {
    if (!this.isBrowser) {
      return false;
    }

    const stored = localStorage.getItem('theme');
    if (stored) {
      return stored === 'dark';
    }

    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
