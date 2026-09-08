import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  email: string = '';
  message: string = '';
  errorMessage: string = '';
  loading: boolean = false;
  submitted: boolean = false;

  constructor(private authService: Auth) {}

  onSubmit() {
    this.errorMessage = '';
    this.message = '';
    this.loading = true;
    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: (res) => {
        this.loading = false;
        this.submitted = true;
        this.message = res.message || 'If an account exists with this email, a password reset link has been sent.';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || err.error?.message || 'Something went wrong. Please try again.';
      }
    });
  }
}