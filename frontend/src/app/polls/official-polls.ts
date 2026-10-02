import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PollsService, PollResponse, PollStatus } from './polls.service';
import { Auth, UserResponse } from '../auth/auth';

@Component({
  selector: 'app-official-polls',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './official-polls.html',
  styleUrl: './official-polls.css'
})
export class OfficialPolls implements OnInit {
  polls: PollResponse[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  activeTab: 'all' | 'mine' | 'active' | 'scheduled' | 'closed' | 'draft' = 'all';
  searchQuery: string = '';
  categoryFilter: string = 'all';

  deleteConfirmId: number | null = null;
  deleting = false;

  // Sidebar and Shell state
  sidebarCollapsed = false;
  mobileSidebarOpen = false;
  logoutConfirmOpen = false;
  loggingOut = false;

  currentUser: UserResponse | null = null;
  userName = 'Official';
  userDepartment = 'Municipal Department';
  userProfilePic: string | null = null;

  categories: string[] = [
    'All Categories',
    'Infrastructure',
    'Environment',
    'Public Safety',
    'Transportation',
    'Education',
    'Healthcare',
    'Housing',
    'Other'
  ];

  constructor(
    private pollsService: PollsService,
    private authService: Auth,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getUser();
    if (this.currentUser) {
      this.userName = this.currentUser.name || 'Official';
      this.userDepartment = this.currentUser.department || 'Municipal Department';
      this.userProfilePic = this.currentUser.profile_picture_url || null;
    }
    this.authService.getMe().subscribe({
      next: (u) => {
        this.currentUser = u;
        if (u) {
          this.userName = u.name || this.userName;
          this.userDepartment = u.department || this.userDepartment;
          this.userProfilePic = u.profile_picture_url || null;
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
    this.loadPolls();
  }

  setTab(tab: 'all' | 'mine' | 'active' | 'scheduled' | 'closed' | 'draft'): void {
    this.activeTab = tab;
    this.loadPolls();
  }

  loadPolls(): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    if (this.activeTab === 'mine') {
      this.pollsService.getMyPolls().subscribe({
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
            this.errorMessage = (typeof detail === 'object' ? detail?.message : detail) || 'Failed to load official polls.';
            this.cdr.detectChanges();
          });
        }
      });
    } else {
      const statusFilter = (this.activeTab === 'all') ? 'all' : this.activeTab;
      this.pollsService.getPolls({ status: statusFilter }).subscribe({
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
            this.errorMessage = (typeof detail === 'object' ? detail?.message : detail) || 'Failed to load official polls.';
            this.cdr.detectChanges();
          });
        }
      });
    }
  }

  get filteredPolls(): PollResponse[] {
    let list = this.polls;
    if (this.categoryFilter !== 'all' && this.categoryFilter !== 'All Categories') {
      list = list.filter(p => p.category?.toLowerCase() === this.categoryFilter.toLowerCase());
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.question?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
      );
    }
    return list;
  }

  get totalPollsCount(): number {
    return this.polls.length;
  }

  get activePollsCount(): number {
    return this.polls.filter(p => p.status === 'active').length;
  }

  get scheduledPollsCount(): number {
    return this.polls.filter(p => p.status === 'scheduled').length;
  }

  get totalVotesCount(): number {
    return this.polls.reduce((sum, p) => sum + (p.total_votes || 0), 0);
  }

  createPoll(): void {
    this.router.navigate(['/official/polls/create']);
  }

  editPoll(pollId: number): void {
    this.router.navigate(['/official/polls', pollId, 'edit']);
  }

  viewResults(pollId: number): void {
    this.router.navigate(['/official/polls', pollId, 'results']);
  }

  toggleStatus(poll: PollResponse): void {
    const newStatus: PollStatus = (poll.status === 'active') ? 'closed' : 'active';
    this.pollsService.patchPollStatus(poll.id, newStatus).subscribe({
      next: (updated) => {
        poll.status = updated.status;
        this.successMessage = `Poll status updated to ${updated.status}.`;
        setTimeout(() => this.successMessage = '', 3500);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail?.message || err.error?.detail || 'Failed to update poll status.';
        this.cdr.detectChanges();
      }
    });
  }

  confirmDelete(pollId: number): void {
    this.deleteConfirmId = pollId;
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
  }

  executeDelete(): void {
    if (!this.deleteConfirmId) return;
    this.deleting = true;
    const id = this.deleteConfirmId;

    this.pollsService.deletePoll(id).subscribe({
      next: () => {
        this.deleting = false;
        this.deleteConfirmId = null;
        this.successMessage = 'Poll deleted successfully.';
        this.polls = this.polls.filter(p => p.id !== id);
        setTimeout(() => this.successMessage = '', 3500);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.deleting = false;
        this.deleteConfirmId = null;
        this.errorMessage = err.error?.detail?.message || err.error?.detail || 'Failed to delete poll.';
        this.cdr.detectChanges();
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  // Sidebar Layout Handlers
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
