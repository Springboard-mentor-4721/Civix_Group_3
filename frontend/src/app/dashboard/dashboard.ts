import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth, UserResponse } from '../auth/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  userName: string = 'Civic Member';
  userLocation: string = 'Civic District';
  userRole: string = 'citizen';
  userEmail: string = '';

  activeNav: string = 'overview';
  mobileSidebarOpen: boolean = false;
  userDropdownOpen: boolean = false;

  constructor(private router: Router, private authService: Auth) {}

  ngOnInit() {
    const user = this.authService.getUser();
    if (user) this.populateUser(user);

    this.authService.getMe().subscribe({
      next: (u) => this.populateUser(u),
      error: () => {}
    });
  }

  private populateUser(user: UserResponse) {
    this.userName = user.name || user.email?.split('@')[0] || 'Citizen';
    this.userLocation = user.location || 'Civic District';
    this.userRole = user.role || 'citizen';
    this.userEmail = user.email || '';
  }

  setNav(nav: string) {
    this.activeNav = nav;
    this.mobileSidebarOpen = false;
  }

  getPageTitle(): string {
    const titles: Record<string, string> = {
      overview: 'Overview',
      petitions: 'Petitions',
      polls: 'Polls & Ballots',
      officials: 'Officials Directory',
      analytics: 'Analytics',
      settings: 'Settings'
    };
    return titles[this.activeNav] || 'Dashboard';
  }

  toggleMobileSidebar() { this.mobileSidebarOpen = !this.mobileSidebarOpen; }

  toggleUserDropdown() { this.userDropdownOpen = !this.userDropdownOpen; }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}
