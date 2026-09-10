import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../auth/auth';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about.html',
  styleUrl: '../pages.css'
})
export class About {
  constructor(private auth: Auth) {}

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }
}
