import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnDestroy {
  email: string = '';
  password: string = '';
  showPassword: boolean = false;
  errorMessage: string = '';
  infoMessage: string = '';
  loading: boolean = false;
  resendingVerification: boolean = false;
  showResendButton: boolean = false;
  submitted: boolean = false;

  // Lockout state
  isLockedOut: boolean = false;
  lockoutSeconds: number = 0;
  private lockoutTimer: any = null;

  constructor(private authService: Auth, private router: Router) {}

  ngOnDestroy() {
    if (this.lockoutTimer) clearInterval(this.lockoutTimer);
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  isEmailValid(): boolean {
    if (!this.email) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(this.email.trim());
  }

  isPasswordValid(): boolean {
    return !!this.password && this.password.length >= 6;
  }

  isFormValid(): boolean {
    return this.isEmailValid() && this.isPasswordValid();
  }

  get lockoutMinutes(): number {
    return Math.floor(this.lockoutSeconds / 60);
  }

  get lockoutRemaining(): string {
    const m = Math.floor(this.lockoutSeconds / 60);
    const s = this.lockoutSeconds % 60;
    if (m > 0) return `${m} min ${s} sec`;
    return `${s} sec`;
  }

  private startLockoutCountdown(minutes: number) {
    this.isLockedOut = true;
    this.lockoutSeconds = minutes * 60;
    if (this.lockoutTimer) clearInterval(this.lockoutTimer);
    this.lockoutTimer = setInterval(() => {
      this.lockoutSeconds--;
      if (this.lockoutSeconds <= 0) {
        clearInterval(this.lockoutTimer);
        this.lockoutTimer = null;
        this.isLockedOut = false;
        this.lockoutSeconds = 0;
        this.errorMessage = '';
      }
    }, 1000);
  }

  onSubmit() {
    if (this.isLockedOut) return;

    this.submitted = true;
    this.errorMessage = '';
    this.infoMessage = '';
    this.showResendButton = false;

    if (!this.email.trim()) {
      this.errorMessage = 'Email address is required.';
      return;
    }

    if (!this.isEmailValid()) {
      this.errorMessage = 'Please enter a valid email address (e.g. name@example.com).';
      return;
    }

    if (!this.password) {
      this.errorMessage = 'Password is required.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    this.loading = true;

    this.authService.login({ email: this.email.trim(), password: this.password }).subscribe({
      next: (tokenRes) => {
        // Fetch fresh profile from /api/auth/me
        this.authService.getMe().subscribe({
          next: () => {
            this.loading = false;
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.loading = false;
            this.router.navigate(['/dashboard']);
          }
        });
      },
      error: (err) => {
        this.loading = false;
        const detail = err.error?.detail || err.error?.message || err.error || 'Invalid email or password';
        this.errorMessage = typeof detail === 'string' ? detail : 'Invalid email or password';

        // Account lockout — HTTP 429
        if (err.status === 429) {
          // Extract minutes from message e.g. "Try again in 14 minute(s)."
          const match = this.errorMessage.match(/(\d+)\s*minute/i);
          const mins = match ? parseInt(match[1], 10) : 15;
          this.startLockoutCountdown(mins);
          return;
        }

        // Official verification pending — HTTP 403
        if (err.status === 403 && this.errorMessage.toLowerCase().includes('verification')) {
          this.showResendButton = true;
          return;
        }

        // Session evicted from another device (backend blacklisted old token) — HTTP 401
        if (err.status === 401 && this.errorMessage.toLowerCase().includes('another device')) {
          this.errorMessage = 'You have been signed out from another device due to the session limit. Please login again.';
        }
      }
    });
  }

  resendVerificationEmail() {
    if (!this.email) return;
    this.resendingVerification = true;
    this.infoMessage = '';

    this.authService.resendVerification(this.email.trim()).subscribe({
      next: (res) => {
        this.resendingVerification = false;
        this.infoMessage = res.message || 'Verification email has been resent. Please check your inbox.';
      },
      error: (err) => {
        this.resendingVerification = false;
        this.errorMessage = err.error?.detail || 'Failed to resend verification email.';
      }
    });
  }
}