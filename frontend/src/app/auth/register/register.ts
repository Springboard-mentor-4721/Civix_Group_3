import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Auth } from '../auth';
import { LocationService } from '../../services/location';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit {
  role: 'citizen' | 'official' = 'citizen';

  name = ''; email = ''; password = ''; confirmPassword = '';
  location = ''; department = '';
  showPassword = false; showConfirmPassword = false;
  errorMessage = ''; successMessage = '';
  loading = false; submitted = false;
  fetchingLocation = false; locationDetectedSuccess = false;
  locationSuggestions: string[] = [];

  // Password validation only applies to citizens
  isPasswordValid() { return this.role === 'official' || this.password.length >= 8; }
  isConfirmPasswordValid() { return this.role === 'official' || (this.confirmPassword === this.password && !!this.confirmPassword); }

  constructor(
    private authService: Auth,
    private router: Router,
    private route: ActivatedRoute,
    private locationService: LocationService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const roleData = this.route.data;
    roleData.subscribe(data => {
      if (data['role']) this.role = data['role'];
    });
    // Also check query param ?role=official
    this.route.queryParams.subscribe(p => {
      if (p['role'] === 'official' || p['role'] === 'citizen') this.role = p['role'];
    });
  }

  setRole(r: 'citizen' | 'official') { this.role = r; }
  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirmPassword() { this.showConfirmPassword = !this.showConfirmPassword; }

  async autoFetchLocation() {
    this.fetchingLocation = true; this.locationDetectedSuccess = false;
    try {
      const place = await this.locationService.getCurrentLocationText();
      this.ngZone.run(() => { this.location = place; this.locationDetectedSuccess = true; this.fetchingLocation = false; this.cdr.detectChanges(); });
    } catch (err: any) {
      this.ngZone.run(() => { this.errorMessage = err.message || 'Could not detect location.'; this.fetchingLocation = false; this.cdr.detectChanges(); });
    }
  }

  onLocationInput() {
    if (!this.location || this.location.trim().length < 3) { this.locationSuggestions = []; return; }
    this.locationService.searchLocations(this.location.trim()).subscribe({
      next: s => { this.locationSuggestions = s; },
      error: () => { this.locationSuggestions = []; }
    });
  }

  selectLocation(loc: string) { this.location = loc; this.locationSuggestions = []; this.locationDetectedSuccess = true; }

  isNameValid() { return this.name.trim().length >= 2; }
  isEmailValid() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()); }
  isLocationValid() { return this.location.trim().length >= 2; }
  isDepartmentValid() { return this.role === 'citizen' || this.department.trim().length >= 2; }

  getPasswordStrength(): { text: string; score: number; colorClass: string } {
    if (!this.password) return { text: '', score: 0, colorClass: '' };
    let score = 0;
    if (this.password.length >= 6) score++;
    if (this.password.length >= 8) score++;
    if (/[A-Z]/.test(this.password) && /[0-9]/.test(this.password)) score++;
    if (/[^A-Za-z0-9]/.test(this.password)) score++;
    if (score <= 1) return { text: 'Weak', score: 1, colorClass: 'strength-weak' };
    if (score <= 3) return { text: 'Medium', score: 2, colorClass: 'strength-medium' };
    return { text: 'Strong', score: 3, colorClass: 'strength-strong' };
  }

  onSubmit() {
    this.submitted = true; this.errorMessage = ''; this.successMessage = '';
    if (!this.isNameValid()) { this.errorMessage = 'Please enter your full name (min 2 characters).'; return; }
    if (!this.isEmailValid()) { this.errorMessage = 'Please enter a valid email address.'; return; }
    if (this.role === 'citizen') {
      if (!this.isPasswordValid()) { this.errorMessage = 'Password must be at least 8 characters.'; return; }
      if (!this.isConfirmPasswordValid()) { this.errorMessage = 'Passwords do not match.'; return; }
    }
    if (!this.isLocationValid()) { this.errorMessage = 'Please enter your location.'; return; }
    if (this.role === 'official' && !this.isDepartmentValid()) { this.errorMessage = 'Please enter your department.'; return; }

    this.loading = true;

    const obs = this.role === 'citizen'
      ? this.authService.registerCitizen({ name: this.name.trim(), email: this.email.trim(), password: this.password, location: this.location.trim() })
      : this.authService.registerOfficial({ name: this.name.trim(), email: this.email.trim(), password: '_temp_', location: this.location.trim(), department: this.department.trim() });

    obs.subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = res.message || 'Registration successful! Please check your email.';
        localStorage.setItem('civix_pending_email', this.email.trim().toLowerCase());
      },
      error: (err) => {
        this.loading = false;
        const detail = err.error?.detail;
        if (detail && typeof detail === 'object') {
          this.errorMessage = detail.message || 'Registration failed.';
        } else {
          this.errorMessage = typeof detail === 'string' ? detail : 'Registration failed. Please try again.';
        }
      }
    });
  }
}
