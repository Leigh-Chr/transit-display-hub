import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { LoginResponse } from '@shared/models';
import { NotifyService } from '../services/notify.service';
import { AuthService } from './auth.service';

/** Guards against the "N requests fire 401 in parallel" race: only the first
 *  one triggers the logout path; the rest just propagate the error. */
let isLoggingOut = false;

/** Single in-flight /refresh call shared across all 401-retrying requests so
 *  N parallel 401s only rotate the refresh token once. */
let pendingRefresh: Observable<LoginResponse> | null = null;

const AUTH_PATH_PREFIX = '/api/auth/';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotifyService);
  const transloco = inject(TranslocoService);

  // Every browser-driven call needs withCredentials: true so the
  // ACCESS_TOKEN / REFRESH_TOKEN / XSRF-TOKEN cookies ride along —
  // Angular's HttpClient otherwise strips them on cross-origin
  // and same-origin alike unless this flag is set.
  const reqWithCreds = req.clone({ withCredentials: true });

  return next(reqWithCreds).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        notify.error(transloco.translate('common.errors.network'));
      }

      const isAuthEndpoint = reqWithCreds.url.includes(AUTH_PATH_PREFIX);

      if (error.status === 401 && !isAuthEndpoint) {
        return runWithRefresh(reqWithCreds, next, authService, router);
      }

      if (error.status === 403) {
        notify.error(transloco.translate('common.errors.accessDenied'));
      }

      return throwError(() => error);
    })
  );
};

function runWithRefresh(
  req: HttpRequest<unknown>,
  next: Parameters<HttpInterceptorFn>[1],
  authService: AuthService,
  router: Router
): Observable<HttpEvent<unknown>> {
  pendingRefresh ??= authService.refresh();

  return pendingRefresh.pipe(
    switchMap(() => {
      pendingRefresh = null;
      return next(req);
    }),
    catchError((refreshError: HttpErrorResponse) => {
      pendingRefresh = null;
      // Refresh itself failed → the session is gone, propagate logout.
      if (!isLoggingOut) {
        isLoggingOut = true;
        const currentUrl = router.url;
        if (
          currentUrl &&
          currentUrl !== '/' &&
          !currentUrl.startsWith('/login') &&
          !currentUrl.startsWith('/display') &&
          !currentUrl.startsWith('/hub')
        ) {
          authService.setRedirectUrl(currentUrl);
        }
        authService.logout();
        // Re-arm after the current microtask so a subsequent fresh login can
        // again be invalidated normally without leaving the flag stuck.
        queueMicrotask(() => { isLoggingOut = false; });
      }
      return throwError(() => refreshError);
    })
  );
}
