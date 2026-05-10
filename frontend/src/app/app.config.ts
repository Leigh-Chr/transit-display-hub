import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { LocaleService } from './core/i18n/locale.service';
import { provideAppTransloco } from './core/i18n/transloco.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppTransloco(),
    // Eagerly construct LocaleService at boot so the language
    // resolved from localStorage / navigator.language is applied
    // before any component renders. Without this, routes that
    // never inject LocaleService (kiosk, hub) stay on the
    // Transloco default ('fr') even when 'lang=en' was persisted
    // in a previous session.
    provideAppInitializer(() => {
      inject(LocaleService);
    }),
  ]
};
