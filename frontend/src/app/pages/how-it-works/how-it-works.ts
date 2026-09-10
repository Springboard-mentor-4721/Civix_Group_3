import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../auth/auth';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './how-it-works.html',
  styleUrl: '../pages.css'
})
export class HowItWorks {
  constructor(private auth: Auth) {}

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }
}
