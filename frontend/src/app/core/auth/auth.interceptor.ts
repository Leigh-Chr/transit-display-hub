import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
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
        snackBar.open('Network error: please check your connection', 'Close', {
          duration: 5000,
          panelClass: 'error-snackbar',
        });
      }
      if (error.status === 401 && !req.url.includes('/auth/login')) {
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
      }
      if (error.status === 403) {
        snackBar.open('Access denied: insufficient permissions', 'Close', {
          duration: 5000,
          panelClass: 'error-snackbar',
        });
      }
      return throwError(() => error);
    })
  );
};
