import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotifyService } from '../services/notify.service';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Guards against the "N requests fire 401 in parallel" race: only the first
 *  one performs the logout / redirect, the rest just propagate the error. */
let isLoggingOut = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotifyService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        notify.error('Network error: please check your connection');
      }
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        if (!isLoggingOut) {
          isLoggingOut = true;
          // Capture where the user was so login can send them back, but skip
          // /login itself and unauthenticated public displays.
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
      }
      if (error.status === 403) {
        notify.error('Access denied: insufficient permissions');
      }
      return throwError(() => error);
    })
  );
};
