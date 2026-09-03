import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../auth';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css'
})
export class VerifyEmail implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  errorMessage: string = '';

  constructor(
    private authService: Auth,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (!token) {
        this.status = 'error';
        this.errorMessage = 'No verification token found in the link.';
        return;
      }

      this.authService.verifyEmail(token).subscribe({
        next: (res) => {
          this.status = 'success';
        },
        error: (err) => {
          this.status = 'error';
          this.errorMessage = err.error?.detail || 'This verification link is invalid or has expired.';
        }
      });
    });
  }
}