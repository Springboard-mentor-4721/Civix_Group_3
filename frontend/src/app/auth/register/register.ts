import { Component, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, UserRegister } from '../auth';
import { LocationService } from '../../services/location';

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
  confirmPassword: string = '';
  location: string = '';
  role: 'citizen' | 'official' = 'citizen';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  loading: boolean = false;
  fetchingLocation: boolean = false;
  locationDetectedSuccess: boolean = false;
  locationSuggestions: string[] = [];

  constructor(
    private authService: Auth,
    private router: Router,
    private locationService: LocationService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirmPassword() { this.showConfirmPassword = !this.showConfirmPassword; }

  setRole(selectedRole: 'citizen' | 'official') {
    this.role = selectedRole;
  }

  async autoFetchLocation() {
    this.errorMessage = '';
    this.fetchingLocation = true;
    this.locationDetectedSuccess = false;
    this.locationSuggestions = [];

    try {
      const placeText = await this.locationService.getCurrentLocationText();
      this.ngZone.run(() => {
        this.location = placeText;
        this.locationDetectedSuccess = true;
        this.fetchingLocation = false;
        this.cdr.detectChanges();
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.errorMessage = err.message || 'Could not detect location. Please enter manually.';
        this.fetchingLocation = false;
        this.cdr.detectChanges();
      });
    }
  }

  onLocationInput() {
    if (!this.location || this.location.trim().length < 3) {
      this.locationSuggestions = [];
      return;
    }

    this.locationService.searchLocations(this.location.trim()).subscribe({
      next: (suggestions) => {
        this.locationSuggestions = suggestions;
      },
      error: () => {
        this.locationSuggestions = [];
      }
    });
  }

  selectLocation(loc: string) {
    this.location = loc;
    this.locationSuggestions = [];
    this.locationDetectedSuccess = true;
  }

  submitted: boolean = false;

  isNameValid(): boolean {
    return !!this.name && this.name.trim().length >= 2;
  }

  isEmailValid(): boolean {
    if (!this.email) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(this.email.trim());
  }

  isPasswordValid(): boolean {
    return !!this.password && this.password.length >= 8;
  }

  isConfirmPasswordValid(): boolean {
    return !!this.confirmPassword && this.confirmPassword === this.password;
  }

  isLocationValid(): boolean {
    return !!this.location && this.location.trim().length >= 2;
  }

  isFormValid(): boolean {
    return (
      this.isNameValid() &&
      this.isEmailValid() &&
      this.isPasswordValid() &&
      this.isConfirmPasswordValid() &&
      this.isLocationValid()
    );
  }

  getPasswordStrength(): { text: string; score: number; colorClass: string } {
    if (!this.password) return { text: '', score: 0, colorClass: '' };
    let score = 0;
    if (this.password.length >= 6) score += 1;
    if (this.password.length >= 8) score += 1;
    if (/[A-Z]/.test(this.password) && /[0-9]/.test(this.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(this.password)) score += 1;

    if (score <= 1) return { text: 'Weak', score: 1, colorClass: 'strength-weak' };
    if (score <= 3) return { text: 'Medium', score: 2, colorClass: 'strength-medium' };
    return { text: 'Strong', score: 3, colorClass: 'strength-strong' };
  }

  onSubmit() {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.isNameValid()) {
      this.errorMessage = 'Please enter your full name (minimum 2 characters).';
      return;
    }

    if (!this.isEmailValid()) {
      this.errorMessage = 'Please enter a valid email address.';
      return;
    }

    if (!this.isPasswordValid()) {
      this.errorMessage = 'Password must be at least 8 characters long.';
      return;
    }

    if (!this.isConfirmPasswordValid()) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    if (!this.isLocationValid()) {
      this.errorMessage = 'Please enter or auto-detect your municipal jurisdiction / city.';
      return;
    }

    this.loading = true;

    const payload: UserRegister = {
      name: this.name.trim(),
      email: this.email.trim(),
      password: this.password,
      role: this.role,
      location: this.location.trim()
    };

    this.authService.register(payload).subscribe({
      next: (res) => {
        this.loading = false;
        if (this.role === 'official') {
          this.successMessage = 'Official account registered! Verification is currently pending review. You will receive an email once approved.';
          setTimeout(() => this.router.navigate(['/login']), 4000);
        } else {
          this.successMessage = 'Registration successful! Redirecting to sign in...';
          setTimeout(() => this.router.navigate(['/login']), 1500);
        }
      },
      error: (err) => {
        this.loading = false;
        const detail = err.error?.detail || err.error?.message || err.error || 'Registration failed. Please check your information.';
        this.errorMessage = typeof detail === 'string' ? detail : 'Registration failed. Email might already be registered.';
      }
    });
  }
}