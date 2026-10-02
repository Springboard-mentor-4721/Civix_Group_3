import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Auth, UserResponse } from '../auth/auth';
import { PetitionService, PetitionResponse, PetitionStatus } from '../services/petition';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-official-petitions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './official-petitions.html',
  styleUrl: './official-petitions.css'
})
export class OfficialPetitions implements OnInit {
  currentUser: UserResponse | null = null;
  sidebarCollapsed: boolean = false;
  mobileSidebarOpen: boolean = false;

  petitions: PetitionResponse[] = [];
  loadingPetitions: boolean = false;
  selectedStatus: string = 'all';
  selectedCategory: string = 'all';
  searchQuery: string = '';
  viewMode: 'grid' | 'table' = 'grid';

  updatingStatusId: number | null = null;
  statusUpdates: Record<number, PetitionStatus> = {};

  selectedPetition: any = null;
  loadingDetail: boolean = false;
  responseText: string = '';
  actionTaken: string = '';
  submittingResponse: boolean = false;

  // Photo Zoom Lightbox
  zoomedPhotoUrl: string | null = null;

  // Logout Modal State
  logoutConfirmOpen: boolean = false;
  loggingOut: boolean = false;

  // Toasts
  toasts: Toast[] = [];
  private toastCounter = 0;

  statuses = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Active',       value: 'active' },
    { label: 'Under Review', value: 'under_review' },
    { label: 'In Progress',  value: 'in_progress' },
    { label: 'Resolved',     value: 'resolved' },
    { label: 'Closed',       value: 'closed' }
  ];

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
    private authService: Auth,
    private petitionService: PetitionService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    if (this.zoomedPhotoUrl) {
      this.closePhotoZoom();
    }
  }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.authService.getMe().subscribe({
      next: (u) => {
        this.currentUser = u;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
    this.loadPetitions();

    // Check if query params specify title or id to auto-open petition detail
    this.route.queryParams.subscribe(params => {
      const petitionId = params['id'];
      if (petitionId) {
        this.petitionService.getPetition(Number(petitionId)).subscribe({
          next: (p) => { this.openPetitionDetail(p); },
          error: () => {}
        });
      }
    });
  }

  toggleSidebarCollapse() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  loadPetitions() {
    this.loadingPetitions = true;
    const params: any = { page: 1, per_page: 100 };
    if (this.selectedStatus !== 'all') params.petition_status = this.selectedStatus as PetitionStatus;
    this.petitionService.getOfficialPetitions(params).subscribe({
      next: (res) => {
        this.petitions = res.petitions || [];
        this.petitions.forEach(p => { this.statusUpdates[p.id] = p.status; });
        this.loadingPetitions = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingPetitions = false;
        this.showToast('Failed to load petitions', 'error');
      }
    });
  }

  get filteredPetitions(): PetitionResponse[] {
    let list = this.petitions;
    if (this.selectedCategory !== 'all' && this.selectedCategory !== 'All Categories') {
      list = list.filter(p => p.category?.toLowerCase() === this.selectedCategory.toLowerCase());
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }

  openPetitionDetail(p: PetitionResponse) {
    this.loadingDetail = true;
    this.selectedPetition = p;
    this.responseText = '';
    this.actionTaken = '';
    this.petitionService.getPetition(p.id).subscribe({
      next: (detail) => {
        this.selectedPetition = detail;
        this.statusUpdates[p.id] = detail.status;
        this.loadingDetail = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDetail = false;
      }
    });
  }

  closePetitionDetail() {
    this.selectedPetition = null;
  }

  createPollForPetition(p: PetitionResponse) {
    if (!p) return;
    this.closePetitionDetail();
    this.router.navigate(['/official/polls/create'], {
      queryParams: {
        petition_id: p.id,
        title: p.title,
        category: p.category,
        location: p.location
      }
    });
  }

  getPetitionPhotos(p: any): string[] {
    if (!p) return [];
    if (p.photos && p.photos.length > 0) {
      return p.photos.map((item: any) => typeof item === 'string' ? item : (item.url || ''));
    }
    if (p.evidence_images && p.evidence_images.length > 0) {
      return p.evidence_images;
    }
    return [];
  }

  openPhotoZoom(url: string) {
    this.zoomedPhotoUrl = url;
  }

  closePhotoZoom() {
    this.zoomedPhotoUrl = null;
  }

  updateStatus(petition: PetitionResponse) {
    const newStatus = this.statusUpdates[petition.id];
    if (!newStatus || newStatus === petition.status) return;
    this.updatingStatusId = petition.id;
    this.petitionService.updatePetitionStatus(petition.id, newStatus).subscribe({
      next: (updated) => {
        petition.status = updated.status;
        this.statusUpdates[petition.id] = updated.status;
        if (this.selectedPetition?.id === petition.id) {
          this.selectedPetition.status = updated.status;
        }
        this.updatingStatusId = null;
        this.showToast(`Status updated to ${this.getStatusLabel(updated.status)}`, 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.updatingStatusId = null;
        this.showToast(err.error?.detail || 'Failed to update status', 'error');
      }
    });
  }

  submitResponse() {
    if (!this.responseText.trim() || !this.selectedPetition) return;
    this.submittingResponse = true;
    this.petitionService.addOfficialResponse(
      this.selectedPetition.id, this.responseText.trim(), this.actionTaken.trim() || undefined
    ).subscribe({
      next: (resp) => {
        this.submittingResponse = false;
        this.responseText = '';
        this.actionTaken = '';
        if (!this.selectedPetition.official_responses) {
          this.selectedPetition.official_responses = [];
        }
        this.selectedPetition.official_responses.unshift(resp);
        this.showToast('Official response published successfully', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submittingResponse = false;
        this.showToast(err.error?.detail || 'Failed to submit response', 'error');
      }
    });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      active: 'Active',
      under_review: 'Under Review',
      in_progress: 'In Progress',
      resolved: 'Resolved',
      closed: 'Closed'
    };
    return map[status] || status;
  }

  getProgressPct(current: number, goal: number): number {
    if (!goal) return 0;
    return Math.min(100, Math.round((current / goal) * 100));
  }

  promptLogout()  { this.logoutConfirmOpen = true; }
  cancelLogout()  { this.logoutConfirmOpen = false; }

  confirmLogout() {
    this.loggingOut = true;
    this.authService.logout().subscribe({
      next:  () => { this.loggingOut = false; this.logoutConfirmOpen = false; this.router.navigate(['/login']); },
      error: () => { this.loggingOut = false; this.logoutConfirmOpen = false; this.router.navigate(['/login']); }
    });
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message, type });
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.cdr.detectChanges();
    }, 4000);
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}
