import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PollsService, PollResponse, PollStatus } from './polls.service';
import { Auth } from '../auth/auth';

@Component({
  selector: 'app-polls-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './polls-list.html',
  styleUrl: './polls-list.css'
})
export class PollsList implements OnInit {
  polls: PollResponse[] = [];
  loading = true;
  errorMessage = '';

  // Layout Shell & User state
  userName: string = 'Civic Member';
  userRole: string = 'citizen';
  userProfilePic: string | null = null;
  sidebarCollapsed: boolean = false;
  mobileSidebarOpen: boolean = false;
  logoutConfirmOpen: boolean = false;
  loggingOut: boolean = false;

  // Filters
  selectedCategory = 'all';
  selectedStatus = 'all';
  locationFilter = '';
  searchQuery = '';

  categories = [
    'Environment',
    'Infrastructure',
    'Education',
    'Public Safety',
    'Transportation',
    'Healthcare',
    'Housing'
  ];

  constructor(
    private pollsService: PollsService,
    private authService: Auth,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    const u = this.authService.getUser();
    if (u) {
      this.userName = u.name || 'Citizen';
      this.userRole = u.role || 'citizen';
      this.userProfilePic = u.profile_picture_url || null;
    }
    this.authService.getMe().subscribe({
      next: (user) => {
        if (user) {
          this.userName = user.name || 'Citizen';
          this.userRole = user.role || 'citizen';
          this.userProfilePic = user.profile_picture_url || null;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });

    this.loadPolls();
  }

  loadPolls(): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.pollsService.getPolls({
      category: this.selectedCategory,
      location: this.locationFilter,
      status: this.selectedStatus,
      search: this.searchQuery
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.polls = res.polls || [];
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loading = false;
          const detail = err?.error?.detail;
          if (typeof detail === 'object' && detail !== null) {
            this.errorMessage = detail.message || 'Failed to load civic polls.';
          } else if (typeof detail === 'string') {
            this.errorMessage = detail;
          } else {
            this.errorMessage = 'Failed to load civic polls.';
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  onFilterChange(): void {
    this.loadPolls();
  }

  resetFilters(): void {
    this.selectedCategory = 'all';
    this.selectedStatus = 'all';
    this.locationFilter = '';
    this.searchQuery = '';
    this.loadPolls();
  }

  getStatusClass(status: PollStatus): string {
    switch (status) {
      case 'active': return 'status-active';
      case 'scheduled': return 'status-scheduled';
      case 'closed': return 'status-closed';
      case 'draft': return 'status-draft';
      default: return '';
    }
  }

  getStatusLabel(status: PollStatus): string {
    switch (status) {
      case 'active': return 'Active';
      case 'scheduled': return 'Scheduled';
      case 'closed': return 'Closed';
      case 'draft': return 'Draft';
      default: return status;
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  viewDetail(poll: PollResponse): void {
    const petSlug = this.slugify(poll.petition_title || `petition-${poll.petition_id || poll.id}`);
    const pollSlug = this.slugify(poll.title);
    if (petSlug && pollSlug) {
      this.router.navigate(['/polls', petSlug, pollSlug]);
    } else {
      this.router.navigate(['/polls', poll.id]);
    }
  }

  // Sidebar Layout Methods
  toggleSidebarCollapse(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }

  promptLogout(): void {
    this.logoutConfirmOpen = true;
  }

  cancelLogout(): void {
    this.logoutConfirmOpen = false;
  }

  confirmLogout(): void {
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

