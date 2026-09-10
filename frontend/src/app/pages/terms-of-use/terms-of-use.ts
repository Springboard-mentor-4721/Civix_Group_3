import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../auth/auth';

@Component({
  selector: 'app-terms-of-use',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './terms-of-use.html',
  styleUrl: '../pages.css'
})
export class TermsOfUse {
  constructor(private auth: Auth) {}

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }
}
