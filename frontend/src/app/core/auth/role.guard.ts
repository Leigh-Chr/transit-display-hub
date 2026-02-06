import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from '@shared/models';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRole: UserRole | undefined = route.data['requiredRole'];

  if (!requiredRole) {
    return true;
  }

  if (authService.getRole() === requiredRole) {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};
