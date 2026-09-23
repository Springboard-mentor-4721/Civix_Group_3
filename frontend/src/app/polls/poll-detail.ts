import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PollsService, PollResponse, PollResultsResponse, PollStatus } from './polls.service';
import { Auth } from '../auth/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-poll-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './poll-detail.html',
  styleUrl: './poll-detail.css'
})
export class PollDetail implements OnInit, OnDestroy {
  pollId!: number;
  poll: PollResponse | null = null;
  results: PollResultsResponse | null = null;
  loading = true;
  voting = false;
  errorMessage = '';
  successMessage = '';

  selectedOptionId: number | null = null;
  showConfirmDialog = false;

  // Layout Shell & User state
  userName: string = 'Civic Member';
  userRole: string = 'citizen';
  userProfilePic: string | null = null;
  sidebarCollapsed: boolean = false;
  mobileSidebarOpen: boolean = false;
  logoutConfirmOpen: boolean = false;
  loggingOut: boolean = false;

  palette: string[] = ['#0d9488', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6'];

  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private routeSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pollsService: PollsService,
    private authService: Auth,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private location: Location
  ) {}

  slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

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

    this.routeSub = this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      const petitionSlug = params.get('petitionSlug');
      const pollSlug = params.get('pollSlug');

      if (idParam) {
        const parsedId = Number(idParam);
        if (!isNaN(parsedId) && parsedId > 0) {
          this.pollId = parsedId;
          this.loadPollDetail();
          return;
        }
      }

      if (petitionSlug && pollSlug) {
        this.resolveSlugsAndLoad(petitionSlug, pollSlug);
        return;
      }

      this.router.navigate(['/polls']);
    });

    // Setup 10s auto-refresh for live results
    this.refreshInterval = setInterval(() => {
      this.refreshLiveResults();
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  resolveSlugsAndLoad(petitionSlug: string, pollSlug: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.pollsService.getPolls({ per_page: 100 }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          const polls = res.polls || [];
          const targetPoll = polls.find(p => {
            const pSlug = this.slugify(p.title);
            const petSlug = this.slugify(p.petition_title || '');
            return (pSlug === pollSlug) || (petSlug && petSlug === petitionSlug && pSlug.includes(pollSlug));
          }) || polls.find(p => this.slugify(p.title) === pollSlug);

          if (targetPoll) {
            this.pollId = targetPoll.id;
            this.loadPollDetail();
          } else {
            this.loading = false;
            this.errorMessage = 'Poll not found for the requested URL.';
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.errorMessage = 'Failed to resolve poll URL.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  updateUrlSlug(): void {
    if (!this.poll) return;
    const petSlug = this.slugify(this.poll.petition_title || `petition-${this.poll.petition_id || this.poll.id}`);
    const pollSlug = this.slugify(this.poll.title);
    if (petSlug && pollSlug) {
      this.location.replaceState(`/polls/${petSlug}/${pollSlug}`);
    }
  }

  loadPollDetail(): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    if (!this.pollId) {
      this.loading = false;
      this.errorMessage = 'Invalid poll ID.';
      this.cdr.detectChanges();
      return;
    }

    this.pollsService.getPollDetail(this.pollId).subscribe({
      next: (res: PollResponse) => {
        this.ngZone.run(() => {
          console.log('[PollDetail] Loaded poll detail from API:', res);
          if (!res) {
            this.errorMessage = 'Poll details not found.';
            this.loading = false;
            this.cdr.detectChanges();
            return;
          }

          res.options = Array.isArray(res.options) ? res.options : [];
          this.poll = res;
          this.loading = false;
          this.errorMessage = '';
          this.updateUrlSlug();
          this.cdr.detectChanges();

          this.fetchResults();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('[PollDetail] Error loading poll detail:', err);
          this.loading = false;
          const detail = err?.error?.detail;
          if (typeof detail === 'object' && detail !== null) {
            this.errorMessage = detail.message || 'Failed to load poll details.';
          } else if (typeof detail === 'string') {
            this.errorMessage = detail;
          } else if (err?.message) {
            this.errorMessage = err.message;
          } else {
            this.errorMessage = 'Failed to load poll details.';
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  refreshLiveResults(): void {
    if (!this.pollId) return;
    this.pollsService.getPollDetail(this.pollId).subscribe({
      next: (res: PollResponse) => {
        this.ngZone.run(() => {
          if (res) {
            res.options = Array.isArray(res.options) ? res.options : [];
            this.poll = res;
            this.cdr.detectChanges();
            this.fetchResults();
          }
        });
      },
      error: () => {}
    });
  }

  fetchResults(): void {
    if (!this.pollId) return;
    this.pollsService.getPollResults(this.pollId).subscribe({
      next: (res: PollResultsResponse) => {
        this.ngZone.run(() => {
          console.log('[PollDetail] Loaded poll results:', res);
          if (res) {
            res.options = Array.isArray(res.options) ? res.options : [];
            res.voting_activity = Array.isArray(res.voting_activity) ? res.voting_activity : [];
            this.results = res;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.warn('Could not fetch live poll results:', err);
      }
    });
  }

  selectOption(optionId: number): void {
    if (this.poll?.has_voted || this.poll?.status !== 'active') return;
    this.selectedOptionId = optionId;
    this.cdr.detectChanges();
  }

  promptConfirm(): void {
    if (!this.selectedOptionId) return;
    this.showConfirmDialog = true;
    this.cdr.detectChanges();
  }

  cancelConfirm(): void {
    this.showConfirmDialog = false;
    this.cdr.detectChanges();
  }

  submitVote(): void {
    if (!this.selectedOptionId || !this.pollId) return;
    this.showConfirmDialog = false;
    this.voting = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.pollsService.vote(this.pollId, this.selectedOptionId).subscribe({
      next: (res: PollResultsResponse) => {
        this.ngZone.run(() => {
          this.voting = false;
          res.options = Array.isArray(res.options) ? res.options : [];
          res.voting_activity = Array.isArray(res.voting_activity) ? res.voting_activity : [];
          this.results = res;
          this.successMessage = 'Your vote has been recorded successfully!';
          if (this.poll) {
            this.poll.has_voted = true;
            this.poll.voted_option_id = this.selectedOptionId;
            this.poll.total_votes = res.total_votes;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.voting = false;
          const detail = err?.error?.detail;
          if (err.status === 409 || (typeof detail === 'object' && detail?.code === 'already_voted')) {
            this.errorMessage = 'You have already voted in this poll.';
            if (this.poll) this.poll.has_voted = true;
            this.fetchResults();
          } else {
            const msg = typeof detail === 'object' ? detail?.message : detail;
            this.errorMessage = msg || err?.message || 'Failed to submit vote. Please try again.';
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  getSelectedOptionText(): string {
    if (!this.poll || !this.selectedOptionId || !Array.isArray(this.poll.options)) return '';
    const opt = this.poll.options.find(o => o.id === this.selectedOptionId);
    return opt ? opt.option_text : '';
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

