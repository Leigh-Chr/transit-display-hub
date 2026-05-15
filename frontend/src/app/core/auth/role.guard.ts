import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { NotifyService } from '../services/notify.service';
import { AuthService } from './auth.service';
import { UserRole } from '@shared/models';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotifyService);
  const transloco = inject(TranslocoService);

  const requiredRole = route.data['requiredRole'] as UserRole | undefined;

  if (!requiredRole) {
    return true;
  }

  if (authService.getRole() === requiredRole) {
    return true;
  }

  notify.error(transloco.translate('common.errors.accessDenied'));
  void router.navigate(['/admin/dashboard']);
  return false;
};
