import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserRegister {
  name: string;
  email: string;
  password: string;
  role: 'citizen' | 'official';
  location: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: 'citizen' | 'official';
  location: string | null;
  is_verified: boolean;
  verification_status: 'not_required' | 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
  email_verified_at: string | null;
}

export interface UserUpdate {
  name?: string;
  location?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface MessageResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private readonly baseUrl = `${environment.apiUrl}/api/auth`;
  private readonly tokenKey = 'civix_token';
  private readonly userKey = 'civix_user';

  private currentUserSubject = new BehaviorSubject<UserResponse | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  private tokenSubject = new BehaviorSubject<string | null>(this.getToken());
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {}

  // 1. Register Citizen or Official
  register(data: UserRegister): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.baseUrl}/register`, data);
  }

  // 2. Login User & obtain JWT Token
  login(data: UserLogin): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.baseUrl}/login`, data).pipe(
      tap((tokenRes) => {
        if (tokenRes && tokenRes.access_token) {
          this.setToken(tokenRes.access_token);
        }
      })
    );
  }

  // 3. Get Authenticated User Details (/api/auth/me)
  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/me`).pipe(
      tap((user) => {
        this.setUser(user);
      })
    );
  }

  // 4. Update Current User Profile (/api/auth/me)
  updateMe(data: UserUpdate): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.baseUrl}/me`, data).pipe(
      tap((updatedUser) => {
        this.setUser(updatedUser);
      })
    );
  }

  // 5. Logout User on Server and clear state
  logout(): Observable<any> {
    const token = this.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    
    return this.http.post(`${this.baseUrl}/logout`, {}, { headers }).pipe(
      tap(() => this.clearSession()),
      catchError(() => {
        // Even if server invalidation fails (e.g. offline), clear local session
        this.clearSession();
        return of({ message: 'Logged out locally' });
      })
    );
  }

  // 6. Verify Email using Token
  verifyEmail(token: string): Observable<MessageResponse> {
    return this.http.get<MessageResponse>(`${this.baseUrl}/verify-email?token=${encodeURIComponent(token)}`);
  }

  // 7. Resend Email Verification Token
  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/resend-verification`, { email });
  }

  // 8. Request Password Reset Link
  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/forgot-password`, { email });
  }

  // 9. Reset Password with Token
  resetPassword(token: string, new_password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/reset-password`, { token, new_password });
  }

  // ── Session & Storage Helpers ────────────────────────────────────────────────

  public getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  public setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this.tokenSubject.next(token);
  }

  public getUser(): UserResponse | null {
    return this.currentUserSubject.value;
  }

  public setUser(user: UserResponse): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    // Also keep legacy 'user' key synchronized for compatibility
    localStorage.setItem('user', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      location: user.location || '',
      is_verified: user.is_verified,
      verification_status: user.verification_status
    }));
    this.currentUserSubject.next(user);
  }

  private getStoredUser(): UserResponse | null {
    const raw = localStorage.getItem(this.userKey) || localStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserResponse;
    } catch {
      return null;
    }
  }

  public clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
  }

  public isAuthenticated(): boolean {
    return !!this.getToken();
  }
}