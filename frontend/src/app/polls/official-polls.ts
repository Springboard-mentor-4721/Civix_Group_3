import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PollsService, PollResponse, PollStatus } from './polls.service';
import { Auth } from '../auth/auth';

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

  // Layout Shell & User state
  userName: string = 'Municipal Officer';
  userRole: string = 'official';
  userDepartment: string = 'Municipal Administration';
  userProfilePic: string | null = null;
  sidebarCollapsed: boolean = false;
  mobileSidebarOpen: boolean = false;
  logoutConfirmOpen: boolean = false;
  loggingOut: boolean = false;

  activeTab: 'all' | 'mine' | 'active' | 'scheduled' | 'closed' | 'draft' = 'all';

  deleteConfirmId: number | null = null;
  deleting = false;

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
          this.cdr.detectChanges();
        }
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
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err.error?.detail?.message || err.error?.detail || 'Failed to update poll status.';
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
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.deleting = false;
        this.deleteConfirmId = null;
        this.errorMessage = err.error?.detail?.message || err.error?.detail || 'Failed to delete poll.';
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
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

