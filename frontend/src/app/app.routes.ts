import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { Dashboard } from './dashboard/dashboard';
import { ForgotPassword } from './auth/forgot-password/forgot-password';
import { ResetPassword } from './auth/reset-password/reset-password';
import { VerifyEmail } from './auth/verify-email/verify-email';
import { PrivacyPolicy } from './pages/privacy-policy/privacy-policy';
import { TermsOfUse } from './pages/terms-of-use/terms-of-use';
import { Contact } from './pages/contact/contact';
import { HelpCenter } from './pages/help-center/help-center';
import { HowItWorks } from './pages/how-it-works/how-it-works';
import { About } from './pages/about/about';
import { authGuard, guestGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'register', component: Register, canActivate: [guestGuard] },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'petitions', component: Dashboard, canActivate: [authGuard] },
  { path: 'polls', component: Dashboard, canActivate: [authGuard] },
  { path: 'officials', component: Dashboard, canActivate: [authGuard] },
  { path: 'analytics', component: Dashboard, canActivate: [authGuard] },
  { path: 'settings', component: Dashboard, canActivate: [authGuard] },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'reset-password', component: ResetPassword },
  { path: 'verify-email', component: VerifyEmail },
  { path: 'privacy-policy', component: PrivacyPolicy },
  { path: 'terms-of-use', component: TermsOfUse },
  { path: 'contact', component: Contact },
  { path: 'help-center', component: HelpCenter },
  { path: 'how-it-works', component: HowItWorks },
  { path: 'about', component: About },
  { path: '**', redirectTo: 'login' }
];