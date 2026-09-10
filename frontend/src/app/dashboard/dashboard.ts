import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Auth, UserResponse } from '../auth/auth';
import { Petitions } from '../petitions/petitions';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, Petitions],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  userName: string = 'Civic Member';
  userLocation: string = 'Civic District';
  userRole: string = 'citizen';
  userEmail: string = '';

  activeNav: string = 'petitions';
  mobileSidebarOpen: boolean = false;
  userDropdownOpen: boolean = false;

  // Logout Confirmation Modal
  logoutConfirmOpen: boolean = false;
  loggingOut: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: Auth
  ) {}

  ngOnInit() {
    const user = this.authService.getUser();
    if (user) this.populateUser(user);

    this.authService.getMe().subscribe({
      next: (u) => this.populateUser(u),
      error: () => {}
    });

    this.updateNavFromUrl();

    // Check query params e.g. ?tab=petitions
    this.route.queryParams.subscribe((params) => {
      if (params['tab']) {
        this.activeNav = params['tab'];
      }
    });
  }

  private updateNavFromUrl() {
    const currentPath = this.router.url.split('?')[0].replace(/^\//, '');
    if (['petitions', 'polls', 'officials', 'analytics', 'settings'].includes(currentPath)) {
      this.activeNav = currentPath;
    } else {
      this.activeNav = 'petitions';
    }
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
    this.router.navigate(['/' + nav]);
  }

  getPageTitle(): string {
    const titles: Record<string, string> = {
      petitions: 'Petitions',
      polls: 'Polls & Ballots',
      officials: 'Officials Directory',
      analytics: 'Analytics',
      settings: 'Settings'
    };
    return titles[this.activeNav] || 'Petitions';
  }

  toggleMobileSidebar() { this.mobileSidebarOpen = !this.mobileSidebarOpen; }

  toggleUserDropdown() { this.userDropdownOpen = !this.userDropdownOpen; }

  promptLogout() {
    this.userDropdownOpen = false;
    this.mobileSidebarOpen = false;
    this.logoutConfirmOpen = true;
  }

  cancelLogout() {
    this.logoutConfirmOpen = false;
  }

  confirmLogout() {
    this.loggingOut = true;
    this.authService.logout().subscribe({
      next: () => {
        this.loggingOut = false;
        this.logoutConfirmOpen = false;
        this.router.navigate(['/login']);
      },
      error: () => {
        this.loggingOut = false;
        this.logoutConfirmOpen = false;
        this.router.navigate(['/login']);
      }
    });
  }
}

