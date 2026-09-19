import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../auth';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css'
})
export class VerifyEmail implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  errorMessage: string = '';
  successMessage: string = '';
  resendEmail: string = '';
  resending: boolean = false;
  resendFeedback: string = '';

  constructor(
    private authService: Auth,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (!token) {
        this.status = 'error';
        this.errorMessage = 'No verification token provided in the link.';
        return;
      }

      this.authService.verifyEmail(token).subscribe({
        next: (res) => {
          this.status = 'success';
          this.successMessage = res.message || 'Email verified! Redirecting to face verification...';
          setTimeout(() => this.router.navigate(['/face-verification']), 2500);
        },
        error: (err) => {
          this.status = 'error';
          const detail = err.error?.detail;
          this.errorMessage = (typeof detail === 'object' ? detail?.message : detail) || 'This verification link is invalid or has expired.';
        }
      });
    });
  }

  onResend() {
    if (!this.resendEmail) return;
    this.resending = true;
    this.resendFeedback = '';

    this.authService.resendVerification(this.resendEmail.trim()).subscribe({
      next: (res) => {
        this.resending = false;
        this.resendFeedback = res.message || 'If an unverified account exists, a new verification link has been sent.';
      },
      error: (err) => {
        this.resending = false;
        this.resendFeedback = err.error?.detail || 'Failed to send verification link.';
      }
    });
  }
}