import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { LocaleService } from './core/i18n/locale.service';
import { provideAppTransloco } from './core/i18n/transloco.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      // Wires Angular's built-in XSRF support to the cookie/header pair
      // Spring sets — every mutating request will copy XSRF-TOKEN into
      // X-XSRF-TOKEN automatically, so we never touch the value ourselves.
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' })
    ),
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
    // Reconstruct the auth session from the httpOnly cookie before the
    // first route resolves. Public routes (kiosk / hub / login) tolerate
    // a 401 here — the app simply stays anonymous in that case.
    provideAppInitializer(() => inject(AuthService).initializeSession()),
  ]
};
