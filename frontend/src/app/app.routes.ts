import { Routes } from '@angular/router';
import { authGuard, guestGuard, citizenGuard, officialGuard, changePasswordGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Public auth
  { path: 'login',             loadComponent: () => import('./auth/login/login').then(m => m.Login),                         canActivate: [guestGuard] },
  { path: 'register',          loadComponent: () => import('./auth/register/register').then(m => m.Register),                canActivate: [guestGuard] },
  { path: 'register/citizen',  loadComponent: () => import('./auth/register/register').then(m => m.Register),                canActivate: [guestGuard], data: { role: 'citizen' } },
  { path: 'register/official', loadComponent: () => import('./auth/register/register').then(m => m.Register),                canActivate: [guestGuard], data: { role: 'official' } },

  // Verification
  { path: 'verify-email',      loadComponent: () => import('./auth/verify-email/verify-email').then(m => m.VerifyEmail) },
  { path: 'face-verification', loadComponent: () => import('./auth/face-verification/face-verification').then(m => m.FaceVerification) },

  // Password change (official first login) — requires valid token in URL
  { path: 'change-password',   loadComponent: () => import('./auth/change-password/change-password').then(m => m.ChangePassword), canActivate: [changePasswordGuard] },

  // Protected dashboards
  { path: 'citizen/dashboard', loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard),                  canActivate: [citizenGuard] },
  { path: 'official/dashboard',loadComponent: () => import('./official-dashboard/official-dashboard').then(m => m.OfficialDashboard), canActivate: [officialGuard] },

  // Legacy dashboard routes (redirect to role-based)
  { path: 'dashboard',         loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard),                  canActivate: [authGuard] },
  { path: 'petitions',         loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard),                  canActivate: [citizenGuard] },
  { path: 'polls',             loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard),                  canActivate: [citizenGuard] },
  { path: 'officials',         loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard),                  canActivate: [citizenGuard] },
  { path: 'analytics',         loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard),                  canActivate: [citizenGuard] },
  { path: 'settings',          loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard),                  canActivate: [authGuard] },

  // Pages
  { path: 'forgot-password',   loadComponent: () => import('./auth/forgot-password/forgot-password').then(m => m.ForgotPassword) },

  { path: '**', redirectTo: 'login' },
];
