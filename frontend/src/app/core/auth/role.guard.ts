import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';
import { UserRole } from '@shared/models';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const requiredRole: UserRole | undefined = route.data['requiredRole'];

  if (!requiredRole) {
    return true;
  }

  if (authService.getRole() === requiredRole) {
    return true;
  }

  snackBar.open('Access denied: insufficient permissions', 'Close', {
    duration: 5000,
    panelClass: 'error-snackbar',
  });
  router.navigate(['/admin/dashboard']);
  return false;
};
