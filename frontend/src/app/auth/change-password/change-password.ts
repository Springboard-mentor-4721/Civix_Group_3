import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth, UserResponse } from '../auth';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css'
})
export class ChangePassword implements OnInit {
  token: string = '';
  isTokenValid: boolean = false;
  validatingToken: boolean = true;
  tokenUserEmail: string = '';

  newPassword: string = '';
  confirmPassword: string = '';
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  loading: boolean = false;
  submitted: boolean = false;

  requestEmail: string = '';
  sendingRequest: boolean = false;
  requestSent: boolean = false;

  constructor(
    private authService: Auth,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Check initial snapshot token
    const initialToken = this.route.snapshot.queryParams['token'] || '';
    if (initialToken) {
      this.token = initialToken;
      this.validateToken();
    }

    this.route.queryParams.subscribe(params => {
      const qToken = params['token'] || '';
      if (qToken && qToken !== this.token) {
        this.token = qToken;
        this.validateToken();
      } else if (!qToken && !initialToken) {
        this.validatingToken = false;
        this.isTokenValid = false;
        this.errorMessage = 'Password change request required. Please request a new password-change link.';
        this.cdr.detectChanges();
      }
    });
  }

  validateToken() {
    if (!this.token) {
      this.validatingToken = false;
      this.isTokenValid = false;
      this.errorMessage = 'Password change request required. Please request a new password-change link.';
      this.cdr.detectChanges();
      return;
    }
    this.validatingToken = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.authService.validatePasswordToken(this.token).subscribe({
      next: (res) => {
        this.validatingToken = false;
        this.isTokenValid = true;
        this.tokenUserEmail = res.email || '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.validatingToken = false;
        this.isTokenValid = false;
        this.errorMessage = err.error?.detail || 'Password change request required. Please request a new password-change link.';
        this.cdr.detectChanges();
      }
    });
  }

  requestNewLink() {
    if (!this.requestEmail.trim()) return;
    this.sendingRequest = true;
    this.cdr.detectChanges();
    this.authService.requestPasswordChange(this.requestEmail.trim()).subscribe({
      next: () => {
        this.sendingRequest = false;
        this.requestSent = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.sendingRequest = false;
        this.requestSent = true; // generic message
        this.cdr.detectChanges();
      }
    });
  }

  toggleNewPassword() { this.showNewPassword = !this.showNewPassword; }
  toggleConfirmPassword() { this.showConfirmPassword = !this.showConfirmPassword; }

  isPasswordValid(): boolean {
    return !!this.newPassword && this.newPassword.length >= 8;
  }

  isConfirmPasswordValid(): boolean {
    return !!this.confirmPassword && this.confirmPassword === this.newPassword;
  }

  getPasswordStrength(): { text: string; score: number; colorClass: string } {
    if (!this.newPassword) return { text: '', score: 0, colorClass: '' };
    let score = 0;
    if (this.newPassword.length >= 6) score += 1;
    if (this.newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(this.newPassword) && /[0-9]/.test(this.newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(this.newPassword)) score += 1;

    if (score <= 1) return { text: 'Weak', score: 1, colorClass: 'strength-weak' };
    if (score <= 3) return { text: 'Medium', score: 2, colorClass: 'strength-medium' };
    return { text: 'Strong', score: 3, colorClass: 'strength-strong' };
  }

  onSubmit() {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.isPasswordValid()) {
      this.errorMessage = 'New password must be at least 8 characters long.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.isConfirmPasswordValid()) {
      this.errorMessage = 'Passwords do not match.';
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    this.authService.changePasswordWithToken(this.token, this.newPassword).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = res.message || 'Password changed successfully! Redirecting to Sign In...';
        this.authService.clearSession();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || err.error?.message || 'Failed to change password. Please request a new link.';
        this.cdr.detectChanges();
      }
    });
  }
}
