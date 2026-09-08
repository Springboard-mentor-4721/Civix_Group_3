import { Component } from '@angular/core';
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
export class Login {
  email: string = '';
  password: string = '';
  showPassword: boolean = false;
  errorMessage: string = '';
  infoMessage: string = '';
  loading: boolean = false;
  resendingVerification: boolean = false;
  showResendButton: boolean = false;

  constructor(private authService: Auth, private router: Router) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    this.errorMessage = '';
    this.infoMessage = '';
    this.showResendButton = false;
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
            // Even if /me fails temporarily, we have the token
            this.loading = false;
            this.router.navigate(['/dashboard']);
          }
        });
      },
      error: (err) => {
        this.loading = false;
        const detail = err.error?.detail || err.error?.message || err.error || 'Invalid email or password';
        this.errorMessage = typeof detail === 'string' ? detail : 'Invalid email or password';

        if (err.status === 403 && this.errorMessage.toLowerCase().includes('verification')) {
          this.showResendButton = true;
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