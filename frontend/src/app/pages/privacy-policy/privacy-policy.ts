import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../auth/auth';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './privacy-policy.html',
  styleUrl: '../pages.css'
})
export class PrivacyPolicy {
  constructor(private auth: Auth) {}

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }
}
