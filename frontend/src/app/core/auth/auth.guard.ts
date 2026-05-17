import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    void router.navigate(['/login']);
    return false;
  }

  // Force the user through the password rotation screen first, e.g. the
  // V52-seeded admin on first login. Guarding the rotation route itself
  // would obviously trap the user there, so let it through.
  if (
    authService.passwordMustChange() &&
    state.url !== '/auth/change-password'
  ) {
    return router.createUrlTree(['/auth/change-password']);
  }

  return true;
};
