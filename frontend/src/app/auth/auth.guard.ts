import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  const user = auth.getUser();
  if (user?.role === 'official') {
    router.navigate([user.must_change_password ? '/login' : '/official/dashboard']);
  } else {
    router.navigate(['/citizen/dashboard']);
  }
  return false;
};

export const citizenGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.isAuthenticated()) { router.navigate(['/login']); return false; }
  const user = auth.getUser();
  if (user?.role !== 'citizen') { router.navigate(['/login']); return false; }
  return true;
};

export const officialGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.isAuthenticated()) { router.navigate(['/login']); return false; }
  const user = auth.getUser();
  if (user?.role !== 'official') { router.navigate(['/login']); return false; }
  // must_change_password: redirect to login — they need to use the emailed token link
  if (user?.must_change_password) { router.navigate(['/login']); return false; }
  return true;
};

// Protects /change-password — requires a token query param; backend validates it
export const changePasswordGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const token = route.queryParams['token'];
  if (!token || token.trim() === '') {
    router.navigate(['/login']);
    return false;
  }
  return true;
};
