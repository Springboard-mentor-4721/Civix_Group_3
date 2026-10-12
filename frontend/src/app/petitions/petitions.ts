import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, HostListener, ViewChild, ElementRef } from '@angular/core';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-petitions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './petitions.html',
  styleUrl: './petitions.css'
})
export class Petitions implements OnInit, OnDestroy {
  // Page view mode: 'list' | 'create' | 'detail' | 'edit'
  viewMode: 'list' | 'create' | 'detail' | 'edit' = 'list';

  // Petitions Layout Mode: 'grid' (Card View) | 'list' (Compact Row View)
  layoutMode: 'grid' | 'list' = 'grid';

  setLayoutMode(mode: 'grid' | 'list') {
    this.layoutMode = mode;
  }

  // Camera / photo state
  @ViewChild('petitionVideoEl') petitionVideoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('petitionCanvasEl') petitionCanvasEl!: ElementRef<HTMLCanvasElement>;
  cameraActive = false;
  capturedPhotos: string[] = [];   // base64 data URLs
  private cameraStream: MediaStream | null = null;
  cameraError = '';

  // Current user info
  currentUser: UserResponse | null = null;
  currentUserId: number = 0;
  currentUserRole: string = 'citizen';
  currentUserLocation: string = '';

  // Tab: 'explore' | 'mine' | 'signed'
  activeTab: 'explore' | 'mine' | 'signed' = 'explore';

  // CIVIX Glass Splash state
  showCivixSplash: boolean = false;
  splashTimer: any = null;

  triggerCivixSplash() {
    this.showCivixSplash = true;
    if (this.splashTimer) {
      clearTimeout(this.splashTimer);
    }
    this.splashTimer = setTimeout(() => {
      this.ngZone.run(() => {
        this.showCivixSplash = false;
        this.cdr.detectChanges();
      });
    }, 1500);
  }

  closeCivixSplash() {
    this.showCivixSplash = false;
    if (this.splashTimer) {
      clearTimeout(this.splashTimer);
    }
  }

  get victoriesCount(): number {
    const closed = this.petitions.filter((p) => p.status === 'closed' || p.status === 'under_review').length;
    return closed > 0 ? closed : 1;
  }

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

  // Photo Zoom Lightbox Modal State
  zoomedPhotoUrl: string | null = null;

  openPhotoZoom(photoUrl: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.zoomedPhotoUrl = photoUrl;
  }

  closePhotoZoom() {
    this.zoomedPhotoUrl = null;
  }

  constructor(
    private petitionService: PetitionService,
    private locationService: LocationService,
    private authService: Auth,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnDestroy() { this.stopCamera(); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.pcard-menu-wrap') && !target.closest('.btn-dot-menu')) {
      this.activeMenuPetitionId = null;
    }
  }

  @HostListener('document:keydown.escape')
  onKeydownHandler() {
    if (this.zoomedPhotoUrl) {
      this.closePhotoZoom();
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

    // Check if deep-link query params contain title slug or id (e.g. ?tab=petitions&title=install-protected-bike-lanes)
    this.route.queryParams.subscribe((params) => {
      const titleSlug = params['title'];
      const id = params['id'];

      if (titleSlug) {
        this.findAndOpenByTitleSlug(titleSlug);
      } else if (id) {
        const petitionId = Number(id);
        if (petitionId && !isNaN(petitionId)) {
          this.loadAndOpenPetitionDetail(petitionId);
        }
      }
    });
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
    this.capturedPhotos = [];
    this.cameraActive = false;
    this.cameraError = '';
    this.viewMode = 'create';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  findAndOpenByTitleSlug(slug: string) {
    if (!slug) return;
    const cleanSlug = slug.toLowerCase().trim();

    const findMatch = (list: PetitionResponse[]) => {
      return list.find(
        (p) => this.slugify(p.title) === cleanSlug || p.title.toLowerCase().trim() === cleanSlug.replace(/-/g, ' ')
      );
    };

    const existingMatch = findMatch(this.petitions);
    if (existingMatch) {
      this.openDetailPage(existingMatch);
      return;
    }

    // If data not loaded in memory yet, fetch list first
    this.petitionService.getPetitions({ page: 1, per_page: 100 }).subscribe({
      next: (res) => {
        this.petitions = res.petitions || [];
        const match = findMatch(this.petitions);
        if (match) {
          this.openDetailPage(match);
        } else if (!isNaN(Number(slug))) {
          this.loadAndOpenPetitionDetail(Number(slug));
        }
      },
      error: () => {}
    });
  }

  loadAndOpenPetitionDetail(id: number) {
    this.loadingDetail = true;
    this.viewMode = 'detail';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.petitionService.getPetition(id).subscribe({
      next: (detail) => {
        this.selectedPetition = detail;
        this.selectedOfficialStatus = detail.status;
        this.loadingDetail = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDetail = false;
        this.showToast('Petition not found', 'error');
        this.backToList();
      }
    });
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

    const titleSlug = this.slugify(petition.title);

    // Sync title slug into browser URL without page reload
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'petitions', title: titleSlug, id: null },
      queryParamsHandling: 'merge'
    });

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
    this.selectedPetition = null;

    // Clear title and id query params
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'petitions', title: null, id: null },
      queryParamsHandling: 'merge'
    });

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

  // ── Camera Methods ─────────────────────────────────────────────────────────

  startCamera() {
    this.cameraError = '';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 1280, height: 720 } })
      .then(stream => {
        this.cameraStream = stream;
        this.cameraActive = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          if (this.petitionVideoEl?.nativeElement) {
            this.petitionVideoEl.nativeElement.srcObject = stream;
          }
        }, 100);
      })
      .catch(() => {
        this.cameraError = 'Camera access denied. Please allow camera access.';
        this.cdr.detectChanges();
      });
  }

  capturePhoto() {
    if (this.capturedPhotos.length >= 5) {
      this.cameraError = 'Maximum 5 photos allowed.';
      return;
    }
    const video  = this.petitionVideoEl?.nativeElement;
    const canvas = this.petitionCanvasEl?.nativeElement;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.capturedPhotos.push(canvas.toDataURL('image/jpeg', 0.85));
    this.cdr.detectChanges();
  }

  removePhoto(index: number) {
    this.capturedPhotos.splice(index, 1);
    this.cdr.detectChanges();
  }

  onGalleryPhotosSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.cameraError = '';
    const files = Array.from(input.files);

    // Filter only images
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      this.cameraError = 'Please select valid image files only.';
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    const availableSlots = 5 - this.capturedPhotos.length;
    if (availableSlots <= 0) {
      this.cameraError = 'Maximum 5 photos allowed.';
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    const filesToProcess = imageFiles.slice(0, availableSlots);
    if (imageFiles.length > availableSlots) {
      this.showToast(`Only ${availableSlots} more photo(s) could be added (max 5).`, 'info');
    }

    let processedCount = 0;
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1600;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            if (this.capturedPhotos.length < 5) {
              this.capturedPhotos.push(dataUrl);
            }
          } else {
            if (this.capturedPhotos.length < 5) {
              this.capturedPhotos.push(e.target.result);
            }
          }
          processedCount++;
          if (processedCount === filesToProcess.length) {
            this.cdr.detectChanges();
          }
        };
        img.onerror = () => {
          processedCount++;
          if (this.capturedPhotos.length < 5) {
            this.capturedPhotos.push(e.target.result);
          }
          if (processedCount === filesToProcess.length) {
            this.cdr.detectChanges();
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  stopCamera() {
    this.cameraStream?.getTracks().forEach(t => t.stop());
    this.cameraStream = null;
    this.cameraActive = false;
  }

  closeCamera() {
    this.stopCamera();
    this.cdr.detectChanges();
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

    if (!this.formTitle.trim()) { this.formErrorMessage = 'Title is required.'; return; }
    if (!this.formDescription.trim()) { this.formErrorMessage = 'Description is required.'; return; }
    if (!this.formLocation.trim()) { this.formErrorMessage = 'Location is required.'; return; }
    if (!this.formSignatureGoal || this.formSignatureGoal <= 0) { this.formErrorMessage = 'Signature goal must be at least 1.'; return; }
    if (this.capturedPhotos.length < 3) { this.formErrorMessage = 'Please provide at least 3 photos (via camera or gallery upload).'; return; }

    this.formSubmitting = true;
    const payload: PetitionCreate = {
      title: this.formTitle.trim(),
      description: this.formDescription.trim(),
      category: this.formCategory,
      location: this.formLocation.trim(),
      signature_goal: Number(this.formSignatureGoal),
      photos: this.capturedPhotos,
    };

    this.petitionService.createPetition(payload).subscribe({
      next: (created) => {
        this.formSubmitting = false;
        this.stopCamera();
        this.capturedPhotos = [];
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
    const titleSlug = this.slugify(p.title);
    const shareUrl = `${window.location.origin}/petitions?tab=petitions&title=${titleSlug}`;
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

  removeToast(id: number) {
    this.dismissToast(id);
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}
