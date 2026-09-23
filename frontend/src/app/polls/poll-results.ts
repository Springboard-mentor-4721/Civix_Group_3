import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  PollOptionResult,
  PollResultsResponse,
  PollsService
} from './polls.service';
import { Auth } from '../auth/auth';

@Component({
  selector: 'app-poll-results',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './poll-results.html',
  styleUrl: './poll-results.css'
})
export class PollResults implements OnInit, OnDestroy {

  pollId!: number;
  results: PollResultsResponse | null = null;
  loading = true;
  errorMessage = '';

  // Layout Shell & User state
  userName: string = 'Municipal Officer';
  userRole: string = 'official';
  userDepartment: string = 'Municipal Administration';
  userProfilePic: string | null = null;
  sidebarCollapsed: boolean = false;
  mobileSidebarOpen: boolean = false;
  logoutConfirmOpen: boolean = false;
  loggingOut: boolean = false;

  palette: string[] = ['#0d9488', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6'];

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pollsService: PollsService,
    private authService: Auth
  ) {}

  ngOnInit(): void {
    const u = this.authService.getUser();
    if (u) {
      this.userName = u.name || 'Official';
      this.userRole = u.role || 'official';
      this.userDepartment = u.department || 'Municipal Administration';
      this.userProfilePic = u.profile_picture_url || null;
    }
    this.authService.getMe().subscribe({
      next: (user) => {
        if (user) {
          this.userName = user.name || 'Official';
          this.userRole = user.role || 'official';
          this.userDepartment = user.department || 'Municipal Administration';
          this.userProfilePic = user.profile_picture_url || null;
        }
      },
      error: () => {}
    });

    const idParam = this.route.snapshot.paramMap.get('id');

    if (!idParam) {
      this.router.navigate(['/official/polls']);
      return;
    }

    const parsedId = Number(idParam);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      this.router.navigate(['/official/polls']);
      return;
    }

    this.pollId = parsedId;

    this.loadResults();

    // Auto refresh every 8 seconds
    this.refreshTimer = setInterval(() => {
      this.loadResults(true);
    }, 8000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  loadResults(silent = false): void {

    // Show loading only on initial load.
    // During auto-refresh, keep existing data visible.
    if (!silent) {
      this.loading = true;
      this.errorMessage = '';
    }

    this.pollsService.getPollResults(this.pollId).subscribe({

      next: (response: PollResultsResponse) => {

        console.log('POLL RESULTS API RESPONSE:', response);

        if (!response) {
          this.errorMessage = 'No poll results were returned by the server.';
          this.loading = false;
          return;
        }

        // Normalize arrays so template never crashes.
        response.options = Array.isArray(response.options)
          ? response.options
          : [];

        response.voting_activity = Array.isArray(response.voting_activity)
          ? response.voting_activity
          : [];

        this.results = response;

        this.loading = false;
        this.errorMessage = '';

        console.log('POLL RESULTS SET:', this.results);
      },

      error: (error) => {

        console.error('POLL RESULTS API ERROR:', error);

        this.loading = false;

        const detail = error?.error?.detail;

        if (typeof detail === 'object' && detail !== null) {
          this.errorMessage =
            detail.message ||
            'Failed to load poll results.';
        } else if (typeof detail === 'string') {
          this.errorMessage = detail;
        } else if (error?.message) {
          this.errorMessage = error.message;
        } else {
          this.errorMessage = 'Failed to load poll results.';
        }
      }
    });
  }

  getTopOption(): PollOptionResult | null {

    if (
      !this.results ||
      !Array.isArray(this.results.options) ||
      this.results.options.length === 0
    ) {
      return null;
    }

    return this.results.options.reduce(
      (top, current) =>
        current.votes > top.votes ? current : top
    );
  }

  getMaxActivityVotes(): number {

    if (
      !this.results ||
      !Array.isArray(this.results.voting_activity) ||
      this.results.voting_activity.length === 0
    ) {
      return 1;
    }

    const maxVotes = Math.max(
      ...this.results.voting_activity.map(activity => activity.votes)
    );

    return maxVotes > 0 ? maxVotes : 1;
  }

  getActivityHeight(votes: number): number {

    const maxVotes = this.getMaxActivityVotes();

    if (maxVotes <= 0) {
      return 0;
    }

    return Math.min((votes / maxVotes) * 100, 100);
  }

  formatDate(dateStr: string | null | undefined): string {

    if (!dateStr) {
      return 'N/A';
    }

    const date = new Date(dateStr);

    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatPercentage(value: number | null | undefined): string {

    if (value === null || value === undefined || Number.isNaN(value)) {
      return '0';
    }

    return Number(value).toFixed(2).replace(/\.00$/, '');
  }

  // SVG Donut Chart Visualizer Methods
  getOptionColor(index: number): string {
    return this.palette[index % this.palette.length];
  }

  getDonutDashArray(pct: number): string {
    const circumference = 439.82;
    const filled = (pct / 100) * circumference;
    return `${filled} ${circumference - filled}`;
  }

  getDonutDashOffset(index: number): string {
    if (!this.results || !Array.isArray(this.results.options)) return '0';
    const circumference = 439.82;
    let accumulated = 0;
    for (let i = 0; i < index; i++) {
      accumulated += (this.results.options[i].percentage || 0);
    }
    const offset = - (accumulated / 100) * circumference;
    return `${offset}`;
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