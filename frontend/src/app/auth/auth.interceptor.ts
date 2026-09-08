import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Auth } from './auth';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(Auth);
  const router = inject(Router);
  const token = authService.getToken();

  const publicEndpoints = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/resend-verification'];
  const isPublic = publicEndpoints.some(ep => req.url.includes(ep));

  let authReq = req;
  if (token && !isPublic && req.url.startsWith(API_URL)) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublic) {
        authService.clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
