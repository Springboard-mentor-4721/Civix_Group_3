import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword implements OnInit {
  token: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  errorMessage: string = '';
  loading: boolean = false;
  submitted: boolean = false;
  tokenMissing: boolean = false;

  constructor(
    private authService: Auth,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.tokenMissing = true;
      }
    });
  }

  toggleNewPassword() { this.showNewPassword = !this.showNewPassword; }
  toggleConfirmPassword() { this.showConfirmPassword = !this.showConfirmPassword; }

  onSubmit() {
    this.errorMessage = '';

    if (this.newPassword.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.loading = true;

    this.authService.changePasswordWithToken(this.token, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.submitted = true;
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || err.error?.message || 'Reset link may be invalid or expired.';
      }
    });
  }
}
