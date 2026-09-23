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
        this.authService.getMe().subscribe({
          next: (user) => {
            this.loading = false;
            if (tokenRes.must_change_password) {
              // Backend has sent a password-change email; clear session and inform user
              this.authService.clearSession();
              this.infoMessage = 'A password-change link has been sent to your email. Please check your inbox to set your permanent password.';
            } else if (user.role === 'official') {
              this.router.navigate(['/official/dashboard']);
            } else {
              this.router.navigate(['/citizen/dashboard']);
            }
          },
          error: () => {
            this.loading = false;
            if (tokenRes.must_change_password) {
              this.authService.clearSession();
              this.infoMessage = 'A password-change link has been sent to your email. Please check your inbox.';
            } else {
              this.router.navigate(['/citizen/dashboard']);
            }
          }
        });
      },
      error: (err) => {
        this.loading = false;
        const detail = err.error?.detail;
        const code = typeof detail === 'object' ? detail?.code : null;
        const msg  = typeof detail === 'object' ? detail?.message : (typeof detail === 'string' ? detail : 'Invalid email or password');

        this.errorMessage = msg || 'Invalid email or password';

        if (err.status === 429) {
          const match = this.errorMessage.match(/(\d+)\s*minute/i);
          const mins = match ? parseInt(match[1], 10) : 15;
          this.startLockoutCountdown(mins);
          return;
        }

        if (code === 'email_not_verified') {
          this.showResendButton = true;
          return;
        }

        if (code === 'face_not_verified') {
          localStorage.setItem('civix_pending_email', this.email.trim().toLowerCase());
          this.router.navigate(['/face-verification']);
          return;
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