import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../auth/auth';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contact.html',
  styleUrl: '../pages.css'
})
export class Contact {
  name = '';
  email = '';
  subject = '';
  message = '';
  submitted = false;

  constructor(private auth: Auth) {}

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }

  onSubmit() {
    if (!this.name || !this.email || !this.subject || !this.message) return;
    this.submitted = true;
  }
}
