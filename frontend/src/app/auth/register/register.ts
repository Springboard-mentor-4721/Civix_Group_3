import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  name: string = '';
  email: string = '';
  password: string = '';
  location: string = '';
  role: string = 'citizen';
  errorMessage: string = '';
  loading: boolean = false;

  constructor(private authService: Auth, private router: Router) {}

  onSubmit() {
    this.errorMessage = '';
    this.loading = true;
    this.authService.register({
      name: this.name,
      email: this.email,
      password: this.password,
      role: this.role,
      location: this.location
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || err.error || 'Registration failed';
      }
    });
  }
}