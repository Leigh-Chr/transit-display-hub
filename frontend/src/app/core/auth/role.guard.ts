import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';
import { UserRole } from '@shared/models';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  const requiredRole = route.data['requiredRole'] as UserRole | undefined;

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
  void router.navigate(['/admin/dashboard']);
  return false;
};
