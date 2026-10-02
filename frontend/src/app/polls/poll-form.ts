import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PollsService, PollCreatePayload, PollUpdatePayload, PollResponse } from './polls.service';
import { Auth } from '../auth/auth';

@Component({
  selector: 'app-poll-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './poll-form.html',
  styleUrl: './poll-form.css'
})
export class PollForm implements OnInit {
  isEditMode = false;
  pollId: number | null = null;
  loading = false;
  submitting = false;
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

  title = '';
  question = '';
  description = '';
  category = 'Infrastructure';
  location = '';
  startAt = '';
  endAt = '';

  options: { option_text: string; display_order: number }[] = [
    { option_text: '', display_order: 0 },
    { option_text: '', display_order: 1 }
  ];

  existingTotalVotes = 0;
  optionsLocked = false;
  petitionId: number | null = null;
  petitionTitle: string | null = null;

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
    private route: ActivatedRoute,
    private router: Router,
    private pollsService: PollsService,
    private authService: Auth,
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
          this.ngZone.run(() => {
            this.userName = user.name || 'Official';
            this.userRole = user.role || 'official';
            this.userDepartment = user.department || 'Municipal Administration';
            this.userProfilePic = user.profile_picture_url || null;
            this.cdr.detectChanges();
          });
        }
      },
      error: () => {}
    });

    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      if (idParam && !isNaN(Number(idParam))) {
        this.isEditMode = true;
        this.pollId = Number(idParam);
        this.loadPollData(this.pollId);
      } else {
        // Default dates (Start: now, End: 7 days from now)
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        this.startAt = this.formatDatetimeLocal(now);
        this.endAt = this.formatDatetimeLocal(nextWeek);
      }
    });

    this.route.queryParams.subscribe((params) => {
      this.ngZone.run(() => {
        if (params['petition_id'] && !isNaN(Number(params['petition_id']))) {
          this.petitionId = Number(params['petition_id']);
          const rawTitle = params['title'] || '';
          this.petitionTitle = rawTitle;
          if (rawTitle && !this.title) {
            this.title = `Civic Poll: ${rawTitle}`;
          }
          if (!this.question) {
            this.question = rawTitle ? `What action should be prioritized for '${rawTitle}'?` : 'What civic priority should be enacted?';
          }
          if (params['category']) this.category = params['category'];
          if (params['location']) this.location = params['location'];
        }
        this.cdr.detectChanges();
      });
    });
  }

  loadPollData(id: number): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.pollsService.getPollDetail(id).subscribe({
      next: (poll) => {
        this.ngZone.run(() => {
          this.loading = false;
          this.title = poll.title;
          this.question = poll.question;
          this.description = poll.description || '';
          this.category = poll.category;
          this.location = poll.location;
          if (poll.start_at) this.startAt = this.formatDatetimeLocal(new Date(poll.start_at));
          if (poll.end_at) this.endAt = this.formatDatetimeLocal(new Date(poll.end_at));
          this.existingTotalVotes = poll.total_votes || 0;

          if (poll.options && poll.options.length > 0) {
            this.options = poll.options.map((o, idx) => ({
              option_text: o.option_text,
              display_order: o.display_order ?? idx
            }));
          }

          if (this.existingTotalVotes > 0) {
            this.optionsLocked = true;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loading = false;
          this.errorMessage = err.error?.detail?.message || err.error?.detail || 'Failed to load poll data.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  addOption(): void {
    if (this.optionsLocked) return;
    this.options.push({ option_text: '', display_order: this.options.length });
  }

  removeOption(index: number): void {
    if (this.optionsLocked || this.options.length <= 2) return;
    this.options.splice(index, 1);
  }

  validateForm(): boolean {
    this.errorMessage = '';

    if (!this.isEditMode && !this.petitionId) {
      this.errorMessage = 'A poll can only be created for an existing citizen petition. Please select a petition from Petition Review.';
      return false;
    }

    if (!this.title.trim()) {
      this.errorMessage = 'Poll Title is required.';
      return false;
    }
    if (!this.question.trim()) {
      this.errorMessage = 'Poll Question is required.';
      return false;
    }
    if (!this.category) {
      this.errorMessage = 'Please select a Category.';
      return false;
    }
    if (!this.location.trim()) {
      this.errorMessage = 'Poll Location is required.';
      return false;
    }
    if (!this.startAt || !this.endAt) {
      this.errorMessage = 'Start date and End date are required.';
      return false;
    }

    const start = new Date(this.startAt);
    const end = new Date(this.endAt);
    if (end <= start) {
      this.errorMessage = 'End date/time must be strictly after Start date/time.';
      return false;
    }

    if (!this.optionsLocked) {
      if (this.options.length < 2) {
        this.errorMessage = 'A poll must have at least 2 options.';
        return false;
      }

      const seen = new Set<string>();
      for (const opt of this.options) {
        const txt = opt.option_text.trim().toLowerCase();
        if (!txt) {
          this.errorMessage = 'All option fields must have non-empty text.';
          return false;
        }
        if (seen.has(txt)) {
          this.errorMessage = 'Duplicate option texts are not allowed.';
          return false;
        }
        seen.add(txt);
      }
    }

    return true;
  }

  onSubmit(): void {
    if (!this.validateForm()) return;

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    const isoStart = new Date(this.startAt).toISOString();
    const isoEnd = new Date(this.endAt).toISOString();

    if (this.isEditMode && this.pollId) {
      const payload: PollUpdatePayload = {
        title: this.title.trim(),
        question: this.question.trim(),
        description: this.description.trim() || undefined,
        category: this.category,
        location: this.location.trim(),
        start_at: isoStart,
        end_at: isoEnd,
      };

      if (!this.optionsLocked) {
        payload.options = this.options.map((o, idx) => ({
          option_text: o.option_text.trim(),
          display_order: idx
        }));
      }

      this.pollsService.updatePoll(this.pollId, payload).subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.submitting = false;
            this.successMessage = 'Poll updated successfully!';
            this.cdr.detectChanges();
            setTimeout(() => this.router.navigate(['/official/polls']), 1200);
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.submitting = false;
            const detail = err.error?.detail;
            this.errorMessage = (typeof detail === 'object' ? detail?.message : detail) || 'Failed to update poll.';
            this.cdr.detectChanges();
          });
        }
      });
    } else {
      const payload: PollCreatePayload = {
        title: this.title.trim(),
        question: this.question.trim(),
        description: this.description.trim() || undefined,
        category: this.category,
        location: this.location.trim(),
        petition_id: this.petitionId!,
        start_at: isoStart,
        end_at: isoEnd,
        options: this.options.map((o, idx) => ({
          option_text: o.option_text.trim(),
          display_order: idx
        }))
      };

      this.pollsService.createPoll(payload).subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.submitting = false;
            this.successMessage = 'Poll created successfully!';
            this.cdr.detectChanges();
            setTimeout(() => this.router.navigate(['/official/polls']), 1200);
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.submitting = false;
            const detail = err.error?.detail;
            this.errorMessage = (typeof detail === 'object' ? detail?.message : detail) || 'Failed to create poll.';
            this.cdr.detectChanges();
          });
        }
      });
    }
  }

  private formatDatetimeLocal(d: Date): string {
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
