import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: 'citizen' | 'official';
  location: string | null;
  department: string | null;
  department_id: string | null;
  email_verified: boolean;
  face_verified: boolean;
  must_change_password: boolean;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  must_change_password: boolean;
}

export interface MessageResponse {
  message: string;
}

export interface ValidateTokenResponse {
  email: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly baseUrl = `${environment.apiUrl}/api/auth`;
  private readonly tokenKey = 'civix_token';
  private readonly userKey  = 'civix_user';

  private currentUserSubject = new BehaviorSubject<UserResponse | null>(this._storedUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  registerCitizen(data: { name: string; email: string; password: string; location: string }): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/register/citizen`, data);
  }

  registerOfficial(data: { name: string; email: string; password: string; location: string; department: string }): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/register/official`, data);
  }

  login(data: { email: string; password: string }): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.baseUrl}/login`, data).pipe(
      tap(res => { if (res?.access_token) this.setToken(res.access_token); })
    );
  }

  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/me`).pipe(
      tap(user => this.setUser(user))
    );
  }

  updateMe(data: { name?: string; location?: string }): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.baseUrl}/me`, data).pipe(
      tap(user => this.setUser(user))
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/logout`, {}).pipe(
      tap(() => this.clearSession()),
      catchError(() => { this.clearSession(); return of({}); })
    );
  }

  verifyEmail(token: string): Observable<MessageResponse> {
    return this.http.get<MessageResponse>(`${this.baseUrl}/verify-email?token=${encodeURIComponent(token)}`);
  }

  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/resend-verification`, { email });
  }

  faceVerification(email: string, image: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/face-verification`, { email, image });
  }

  requestPasswordChange(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/request-password-change`, { email });
  }

  validatePasswordToken(token: string): Observable<ValidateTokenResponse> {
    return this.http.post<ValidateTokenResponse>(`${this.baseUrl}/validate-password-token`, { token });
  }

  changePasswordWithToken(token: string, new_password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/change-password`, { token, new_password });
  }

  // Legacy — kept for forgot-password page compatibility
  forgotPassword(email: string): Observable<MessageResponse> {
    return this.requestPasswordChange(email);
  }

  // ── Session helpers ──────────────────────────────────────────────────────────

  getToken(): string | null { return localStorage.getItem(this.tokenKey); }

  setToken(token: string): void { localStorage.setItem(this.tokenKey, token); }

  getUser(): UserResponse | null { return this.currentUserSubject.value; }

  setUser(user: UserResponse): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean { return !!this.getToken(); }

  private _storedUser(): UserResponse | null {
    const raw = localStorage.getItem(this.userKey) || localStorage.getItem('user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
}
