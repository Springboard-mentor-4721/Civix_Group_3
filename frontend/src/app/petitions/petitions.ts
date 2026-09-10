import { Component, OnInit, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PetitionService,
  PetitionResponse,
  PetitionDetailResponse,
  PetitionCategory,
  PetitionStatus,
  PetitionCreate,
  PetitionUpdate,
  SignedPetitionItem
} from '../services/petition';
import { LocationService } from '../services/location';
import { Auth, UserResponse } from '../auth/auth';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-petitions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './petitions.html',
  styleUrl: './petitions.css'
})
export class Petitions implements OnInit {
  // Page view mode: 'list' | 'create' | 'detail' | 'edit'
  viewMode: 'list' | 'create' | 'detail' | 'edit' = 'list';

  // Current user info
  currentUser: UserResponse | null = null;
  currentUserId: number = 0;
  currentUserRole: string = 'citizen';
  currentUserLocation: string = '';

  // Tab: 'explore' | 'mine' | 'signed'
  activeTab: 'explore' | 'mine' | 'signed' = 'explore';

  // Filters
  searchQuery: string = '';
  selectedCategory: string = 'All';
  selectedStatus: string = 'all';

  // Category expand state
  categoriesExpanded: boolean = false;

  allCategories: (PetitionCategory | 'All')[] = [
    'All',
    'Environment',
    'Infrastructure',
    'Education',
    'Public Safety',
    'Transportation',
    'Healthcare',
    'Housing'
  ];

  statuses = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Under Review', value: 'under_review' },
    { label: 'Closed', value: 'closed' }
  ];

  // Data lists
  petitions: PetitionResponse[] = [];
  myPetitions: PetitionResponse[] = [];
  signedPetitions: SignedPetitionItem[] = [];
  signedPetitionIds: Set<number> = new Set<number>();

  // Counts / stats
  totalCount: number = 0;
  myActiveCount: number = 0;
  myClosedCount: number = 0;
  loading: boolean = false;
  signingPetitionId: number | null = null;

  // Selected for detail / edit
  selectedPetition: PetitionDetailResponse | null = null;
  loadingDetail: boolean = false;

  // 3-dot menu state
  activeMenuPetitionId: number | null = null;

  // Delete confirmation modal state
  deleteModalOpen: boolean = false;
  petitionToDelete: PetitionResponse | null = null;
  deletingPetition: boolean = false;

  // Form Model for Create / Edit Page
  formTitle: string = '';
  formDescription: string = '';
  formCategory: PetitionCategory = 'Environment';
  formLocation: string = '';
  formSignatureGoal: number = 100;
  formSubmitted: boolean = false;
  formSubmitting: boolean = false;
  formErrorMessage: string = '';
  editingPetitionId: number | null = null;

  // Location detection
  detectingLocation: boolean = false;

  // Official Status updating
  updatingStatus: boolean = false;
  selectedOfficialStatus: PetitionStatus = 'active';

  // Toast notifications
  toasts: Toast[] = [];
  private toastCounter = 0;

  constructor(
    private petitionService: PetitionService,
    private locationService: LocationService,
    private authService: Auth,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.pcard-menu-wrap') && !target.closest('.btn-dot-menu')) {
      this.activeMenuPetitionId = null;
    }
  }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    if (this.currentUser) {
      this.currentUserId = this.currentUser.id;
      this.currentUserRole = this.currentUser.role;
      this.currentUserLocation = this.currentUser.location || '';
    }

    this.authService.getMe().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.currentUserId = user.id;
        this.currentUserRole = user.role;
        this.currentUserLocation = user.location || '';
      },
      error: () => {}
    });

    this.loadAllData();
  }

  loadAllData() {
    this.loadPetitions();
    this.loadMyPetitions();
    this.loadSignedPetitions();
  }

  // ── Data Loading ─────────────────────────────────────────────────────────────

  loadPetitions() {
    this.loading = true;
    const params: any = { page: 1, per_page: 50 };

    if (this.selectedCategory !== 'All') {
      params.category = this.selectedCategory as PetitionCategory;
    }
    if (this.selectedStatus !== 'all') {
      params.petition_status = this.selectedStatus as PetitionStatus;
    }

    this.petitionService.getPetitions(params).subscribe({
      next: (res) => {
        this.petitions = res.petitions || [];
        this.totalCount = res.total || 0;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.showToast('Failed to load petitions', 'error');
      }
    });
  }

  loadMyPetitions() {
    this.petitionService.getMyPetitions().subscribe({
      next: (res) => {
        this.myPetitions = res.petitions || [];
        this.myActiveCount = res.active_count || 0;
        this.myClosedCount = res.closed_count || 0;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadSignedPetitions() {
    this.petitionService.getSignedPetitions().subscribe({
      next: (res) => {
        this.signedPetitions = res.petitions || [];
        this.signedPetitionIds = new Set(this.signedPetitions.map((p) => p.id));
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ── Tab & Category Filter Handlers ──────────────────────────────────────────

  setTab(tab: 'explore' | 'mine' | 'signed') {
    this.activeTab = tab;
    this.viewMode = 'list';
    if (tab === 'explore') this.loadPetitions();
    if (tab === 'mine') this.loadMyPetitions();
    if (tab === 'signed') this.loadSignedPetitions();
  }

  toggleCategoriesExpanded() {
    this.categoriesExpanded = !this.categoriesExpanded;
  }

  get visibleCategories(): (PetitionCategory | 'All')[] {
    if (this.categoriesExpanded) {
      return this.allCategories;
    }
    // Collapsed: Show first 4
    return this.allCategories.slice(0, 4);
  }

  onCategorySelect(cat: PetitionCategory | 'All') {
    this.selectedCategory = cat;
    this.loadPetitions();
  }

  onStatusSelect(status: string) {
    this.selectedStatus = status;
    this.loadPetitions();
  }

  get displayedPetitions(): PetitionResponse[] {
    let list: PetitionResponse[] = [];
    if (this.activeTab === 'explore') {
      list = this.petitions;
    } else if (this.activeTab === 'mine') {
      list = this.myPetitions;
    } else if (this.activeTab === 'signed') {
      list = this.signedPetitions;
    }

    if (!this.searchQuery.trim()) {
      return list;
    }

    const q = this.searchQuery.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  // ── Page View Navigation ───────────────────────────────────────────────────

  openCreatePage() {
    this.editingPetitionId = null;
    this.formTitle = '';
    this.formDescription = '';
    this.formCategory = 'Environment';
    this.formLocation = this.currentUserLocation || '';
    this.formSignatureGoal = 100;
    this.formSubmitted = false;
    this.formErrorMessage = '';
    this.viewMode = 'create';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openDetailPage(petition: PetitionResponse, event?: Event) {
    if (event) {
      const target = event.target as HTMLElement;
      if (target.closest('.pcard-menu-wrap') || target.closest('.btn-dot-menu') || target.closest('.btn-sign') || target.closest('.btn-signed')) {
        return;
      }
    }

    this.loadingDetail = true;
    this.viewMode = 'detail';
    this.selectedOfficialStatus = petition.status;
    this.selectedPetition = {
      ...petition,
      has_signed: this.signedPetitionIds.has(petition.id)
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.petitionService.getPetition(petition.id).subscribe({
      next: (detail) => {
        this.selectedPetition = detail;
        this.selectedOfficialStatus = detail.status;
        this.loadingDetail = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDetail = false;
      }
    });
  }

  openEditPage(p: PetitionResponse, event?: Event) {
    if (event) event.stopPropagation();
    this.activeMenuPetitionId = null;

    if (p.status === 'closed') {
      this.showToast('Closed petitions cannot be edited', 'error');
      return;
    }

    this.editingPetitionId = p.id;
    this.formTitle = p.title;
    this.formDescription = p.description;
    this.formCategory = p.category;
    this.formLocation = p.location;
    this.formSignatureGoal = p.signature_goal;
    this.formSubmitted = false;
    this.formErrorMessage = '';
    this.viewMode = 'edit';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToList() {
    this.viewMode = 'list';
    this.activeMenuPetitionId = null;
    this.loadAllData();
  }

  // ── 3-Dot Menu Actions ─────────────────────────────────────────────────────

  toggleCardMenu(petitionId: number, event: Event) {
    event.stopPropagation();
    if (this.activeMenuPetitionId === petitionId) {
      this.activeMenuPetitionId = null;
    } else {
      this.activeMenuPetitionId = petitionId;
    }
  }

  // ── Location Detection ─────────────────────────────────────────────────────

  async autoDetectLocation() {
    this.detectingLocation = true;
    try {
      const placeText = await this.locationService.getCurrentLocationText();
      this.ngZone.run(() => {
        this.formLocation = placeText;
        this.detectingLocation = false;
        this.showToast(`Location detected: ${placeText}`, 'success');
        this.cdr.detectChanges();
      });
    } catch (err: any) {
      this.ngZone.run(() => {
        this.detectingLocation = false;
        this.showToast('Could not detect location. Please type manually.', 'error');
        this.cdr.detectChanges();
      });
    }
  }

  // ── Create / Edit Submission ───────────────────────────────────────────────

  submitCreatePetition() {
    this.formSubmitted = true;
    this.formErrorMessage = '';

    if (!this.formTitle.trim()) {
      this.formErrorMessage = 'Title is required.';
      return;
    }
    if (!this.formDescription.trim()) {
      this.formErrorMessage = 'Description is required.';
      return;
    }
    if (!this.formLocation.trim()) {
      this.formErrorMessage = 'Location is required.';
      return;
    }
    if (!this.formSignatureGoal || this.formSignatureGoal <= 0) {
      this.formErrorMessage = 'Signature goal must be at least 1.';
      return;
    }

    this.formSubmitting = true;
    const payload: PetitionCreate = {
      title: this.formTitle.trim(),
      description: this.formDescription.trim(),
      category: this.formCategory,
      location: this.formLocation.trim(),
      signature_goal: Number(this.formSignatureGoal)
    };

    this.petitionService.createPetition(payload).subscribe({
      next: (created) => {
        this.formSubmitting = false;
        this.showToast('Petition published successfully!', 'success');
        this.viewMode = 'list';
        this.loadAllData();
      },
      error: (err) => {
        this.formSubmitting = false;
        const detail = err.error?.detail || err.error?.message || 'Failed to create petition';
        this.formErrorMessage = typeof detail === 'string' ? detail : 'Failed to create petition';
      }
    });
  }

  submitEditPetition() {
    if (!this.editingPetitionId) return;
    this.formSubmitted = true;
    this.formErrorMessage = '';

    if (!this.formTitle.trim()) {
      this.formErrorMessage = 'Title is required.';
      return;
    }
    if (!this.formDescription.trim()) {
      this.formErrorMessage = 'Description is required.';
      return;
    }
    if (!this.formLocation.trim()) {
      this.formErrorMessage = 'Location is required.';
      return;
    }
    if (!this.formSignatureGoal || this.formSignatureGoal <= 0) {
      this.formErrorMessage = 'Signature goal must be at least 1.';
      return;
    }

    this.formSubmitting = true;
    const payload: PetitionUpdate = {
      title: this.formTitle.trim(),
      description: this.formDescription.trim(),
      category: this.formCategory,
      location: this.formLocation.trim(),
      signature_goal: Number(this.formSignatureGoal)
    };

    this.petitionService.updatePetition(this.editingPetitionId, payload).subscribe({
      next: (updated) => {
        this.formSubmitting = false;
        this.showToast('Petition updated successfully!', 'success');
        if (this.selectedPetition && this.selectedPetition.id === updated.id) {
          this.selectedPetition = { ...this.selectedPetition, ...updated };
          this.viewMode = 'detail';
        } else {
          this.viewMode = 'list';
        }
        this.loadAllData();
      },
      error: (err) => {
        this.formSubmitting = false;
        const detail = err.error?.detail || err.error?.message || 'Failed to update petition';
        this.formErrorMessage = typeof detail === 'string' ? detail : 'Failed to update petition';
      }
    });
  }

  // ── Actions: Sign, Delete, Status, Share ───────────────────────────────────

  signPetition(p: PetitionResponse, event?: Event) {
    if (event) event.stopPropagation();

    if (p.creator_id === this.currentUserId) {
      this.showToast('You cannot sign your own petition', 'info');
      return;
    }
    if (p.status !== 'active') {
      this.showToast('Only active petitions can be signed', 'info');
      return;
    }
    if (this.hasUserSigned(p.id)) {
      this.showToast('You have already signed this petition', 'info');
      return;
    }

    this.signingPetitionId = p.id;
    this.petitionService.signPetition(p.id).subscribe({
      next: (res) => {
        this.signingPetitionId = null;
        p.signature_count = res.signature_count;
        this.signedPetitionIds.add(p.id);

        if (this.selectedPetition && this.selectedPetition.id === p.id) {
          this.selectedPetition.signature_count = res.signature_count;
          this.selectedPetition.has_signed = true;
        }

        this.showToast('Successfully signed petition!', 'success');
        this.loadSignedPetitions();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.signingPetitionId = null;
        const detail = err.error?.detail || 'Failed to sign petition';
        this.showToast(typeof detail === 'string' ? detail : 'Failed to sign petition', 'error');
      }
    });
  }

  promptDelete(p: PetitionResponse, event?: Event) {
    if (event) event.stopPropagation();
    this.activeMenuPetitionId = null;
    this.petitionToDelete = p;
    this.deleteModalOpen = true;
  }

  cancelDelete() {
    this.deleteModalOpen = false;
    this.petitionToDelete = null;
  }

  confirmDelete() {
    if (!this.petitionToDelete) return;
    this.deletingPetition = true;

    this.petitionService.deletePetition(this.petitionToDelete.id).subscribe({
      next: () => {
        this.deletingPetition = false;
        this.deleteModalOpen = false;
        this.showToast('Petition deleted successfully', 'success');
        if (this.viewMode === 'detail' && this.selectedPetition?.id === this.petitionToDelete?.id) {
          this.viewMode = 'list';
        }
        this.petitionToDelete = null;
        this.loadAllData();
      },
      error: (err) => {
        this.deletingPetition = false;
        const detail = err.error?.detail || 'Failed to delete petition';
        this.showToast(typeof detail === 'string' ? detail : 'Failed to delete petition', 'error');
      }
    });
  }

  updateOfficialStatus(p: PetitionResponse) {
    if (this.currentUserRole !== 'official') return;
    this.updatingStatus = true;

    this.petitionService.updatePetitionStatus(p.id, this.selectedOfficialStatus).subscribe({
      next: (updated) => {
        this.updatingStatus = false;
        p.status = updated.status;
        if (this.selectedPetition && this.selectedPetition.id === p.id) {
          this.selectedPetition.status = updated.status;
        }
        this.showToast(`Status updated to ${this.getStatusLabel(updated.status)}`, 'success');
        this.loadAllData();
      },
      error: (err) => {
        this.updatingStatus = false;
        const detail = err.error?.detail || 'Failed to update status';
        this.showToast(typeof detail === 'string' ? detail : 'Failed to update status', 'error');
      }
    });
  }

  sharePetition(p: PetitionResponse, event?: Event) {
    if (event) event.stopPropagation();
    this.activeMenuPetitionId = null;
    const shareUrl = `${window.location.origin}/dashboard?tab=petitions&id=${p.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      this.showToast('Petition link copied to clipboard!', 'success');
    } else {
      this.showToast(`Share URL: ${shareUrl}`, 'info');
    }
  }

  // ── Helper Getters ──────────────────────────────────────────────────────────

  hasUserSigned(petitionId: number): boolean {
    if (this.selectedPetition && this.selectedPetition.id === petitionId && this.selectedPetition.has_signed) {
      return true;
    }
    return this.signedPetitionIds.has(petitionId);
  }

  getProgressPercentage(current: number, goal: number): number {
    if (!goal || goal <= 0) return 0;
    return Math.min(100, Math.round((current / goal) * 100));
  }

  getStatusLabel(status: PetitionStatus | string): string {
    const map: Record<string, string> = {
      active: 'Active',
      under_review: 'Under Review',
      closed: 'Closed'
    };
    return map[status] || status;
  }

  getCategoryColor(cat: PetitionCategory | string): string {
    const map: Record<string, string> = {
      Environment: 'cat-env',
      Infrastructure: 'cat-infra',
      Education: 'cat-edu',
      'Public Safety': 'cat-safety',
      Transportation: 'cat-trans',
      Healthcare: 'cat-health',
      Housing: 'cat-housing'
    };
    return map[cat] || 'cat-default';
  }

  // ── Toasts ──────────────────────────────────────────────────────────────────

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message, type });
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.cdr.detectChanges();
    }, 4000);
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}
