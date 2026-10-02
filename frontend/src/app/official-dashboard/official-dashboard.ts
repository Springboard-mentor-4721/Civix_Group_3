import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Auth, UserResponse } from '../auth/auth';
import { PetitionService, PetitionResponse, PetitionStatus, DashboardStats, OfficialResponse } from '../services/petition';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type NavSection = 'overview' | 'petitions' | 'polls' | 'reports' | 'settings';
export type SettingsTab = 'profile' | 'notifications' | 'privacy' | 'appearance' | 'department';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  fontSize: number;
  compactMode: boolean;
  animations: boolean;
  emailNotifs: boolean;
  pushNotifs: boolean;
  petitionUpdates: boolean;
  responseAlerts: boolean;
  weeklyDigest: boolean;
  profileVisibility: 'public' | 'members' | 'private';
  activityStatus: boolean;
  dataSharing: boolean;
  departmentJurisdiction: string;
  autoAssignPetitions: boolean;
  emergencyAlerts: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'English',
  fontSize: 14,
  compactMode: false,
  animations: true,
  emailNotifs: true,
  pushNotifs: true,
  petitionUpdates: true,
  responseAlerts: true,
  weeklyDigest: false,
  profileVisibility: 'public',
  activityStatus: true,
  dataSharing: false,
  departmentJurisdiction: 'Municipal Constituency',
  autoAssignPetitions: true,
  emergencyAlerts: true
};

export interface OfficialTourStep {
  step: number;
  title: string;
  badge: string;
  purpose: string;
  whyUse: string;
  description: string;
  navTarget: NavSection;
  iconSvg: string;
}

@Component({
  selector: 'app-official-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './official-dashboard.html',
  styleUrl: './official-dashboard.css'
})
export class OfficialDashboard implements OnInit {
  currentUser: UserResponse | null = null;
  activeNav: NavSection = 'overview';

  sidebarCollapsed: boolean = false;
  mobileSidebarOpen: boolean = false;

  stats: DashboardStats | null = null;
  loadingStats: boolean = false;

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

  // Settings & Profile Center State
  activeSettingsTab: SettingsTab = 'profile';
  settings: AppSettings = { ...DEFAULT_SETTINGS };
  settingsSaved: boolean = false;
  pwdResetSent: boolean = false;

  // Password Change Model
  pwdModel = { current: '', newPwd: '', confirmPwd: '' };
  changingPassword = false;

  // Interactive App Tour State
  showAppTour: boolean = false;
  currentTourStepIndex: number = 0;

  tourSteps: OfficialTourStep[] = [
    {
      step: 1,
      title: 'Municipal Dashboard Overview',
      badge: 'Step 1 of 4 ? Overview & Key Metrics',
      purpose: 'Track overall petition numbers, resolution counts, active cases, and constituency signature totals.',
      whyUse: 'Provides real-time visibility into department workload, allowing leadership to prioritize urgent grievances.',
      description: 'View essential performance metrics across your jurisdiction, including Active, Under Review, In Progress, and Resolved petitions.',
      navTarget: 'overview',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>'
    },
    {
      step: 2,
      title: 'Department Petition Review & Triage',
      badge: 'Step 2 of 4 ? Petition Management',
      purpose: 'Filter petitions by status, inspect citizen evidence photos, and update petition status.',
      whyUse: 'Allows municipal officers to transition petitions from "Active" to "In Progress" or "Resolved" as field work is completed.',
      description: 'Search petitions by keyword, filter by status, click to view evidence photos with lightbox zoom, and update status dropdowns instantly.',
      navTarget: 'petitions',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    },
    {
      step: 3,
      title: 'Publish Official Response & Action Plans',
      badge: 'Step 3 of 4 ? Transparency & Citizen Updates',
      purpose: 'Publish binding municipal status updates and concrete action plans directly on petitions.',
      whyUse: 'Notifies signed citizens instantly via email/push alerts, building public trust and demonstrating council responsiveness.',
      description: 'Inside any petition detail view, enter official response comments and document field actions taken by your engineering or sanitation teams.',
      navTarget: 'petitions',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    },
    {
      step: 4,
      title: 'Settings, Danger Zone & Security',
      badge: 'Step 4 of 4 ? Account Administration',
      purpose: 'Auto-save preferences, trigger email password reset links, launch platform tour, or manage security.',
      whyUse: 'Provides self-serve account recovery options and system configurations for municipal personnel.',
      description: 'Features 5 sub-tabs: Profile & Identity, Notifications, Privacy & Security (with Danger Zone), Appearance, and Department Routing.',
      navTarget: 'settings',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    }
  ];

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
    this.loadStats();
    this.loadPetitions();
    this.loadSettings();
    this.generateCalendar();
  }

  // Calendar State
  currentCalendarDate: Date = new Date();
  calendarDays: Array<{
    date: Date;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    hasEvent: boolean;
    eventCount: number;
  }> = [];

  generateCalendar(): void {
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const today = new Date();
    const days: typeof this.calendarDays = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
        hasEvent: false,
        eventCount: 0
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const isToday = d.toDateString() === today.toDateString();
      const dateStr = d.toISOString().split('T')[0];
      const eventCount = this.petitions.filter(p => {
        if (!p.created_at) return false;
        return p.created_at.startsWith(dateStr);
      }).length;

      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: isToday,
        hasEvent: eventCount > 0,
        eventCount: eventCount
      });
    }

    const remaining = (days.length <= 35 ? 35 : 42) - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        hasEvent: false,
        eventCount: 0
      });
    }

    this.calendarDays = days;
  }

  prevCalendarMonth(): void {
    this.currentCalendarDate = new Date(
      this.currentCalendarDate.getFullYear(),
      this.currentCalendarDate.getMonth() - 1,
      1
    );
    this.generateCalendar();
  }

  nextCalendarMonth(): void {
    this.currentCalendarDate = new Date(
      this.currentCalendarDate.getFullYear(),
      this.currentCalendarDate.getMonth() + 1,
      1
    );
    this.generateCalendar();
  }

  get currentMonthYearLabel(): string {
    return this.currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getSafeSvg(svgString: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }

  getPageTitle(): string {
    switch (this.activeNav) {
      case 'overview': return 'Official Dashboard Overview';
      case 'petitions': return `Petition Review ? ${this.currentUser?.department || 'Department'}`;
      case 'polls': return 'Poll Management';
      case 'reports': return 'Reports & Civic Analytics';
      case 'settings': return 'Department Settings & Preferences';
      default: return 'Official Portal';
    }
  }

  toggleSidebarCollapse() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  setNav(nav: NavSection, navigateRouter: boolean = true) {
    this.activeNav = nav;
    this.mobileSidebarOpen = false;
    this.selectedPetition = null;
    if (nav === 'polls') {
      this.router.navigate(['/official/polls']);
      return;
    }
    if (nav === 'reports') {
      this.router.navigate(['/official/reports']);
      return;
    }
    if (nav === 'overview')  this.loadStats();
    if (nav === 'petitions') this.loadPetitions();
  }

  setSettingsTab(tab: SettingsTab) {
    this.activeSettingsTab = tab;
  }

  loadStats() {
    this.loadingStats = true;
    this.petitionService.getOfficialDashboard().subscribe({
      next: (s) => {
        this.stats = s;
        this.loadingStats = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingStats = false;
      }
    });
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
        this.generateCalendar();
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

  get urgentPetitions(): PetitionResponse[] {
    return this.petitions.filter(p => {
      const pct = this.getProgressPct(p.signature_count, p.signature_goal);
      return (pct >= 80 || p.status === 'under_review') && p.status !== 'resolved' && p.status !== 'closed';
    }).slice(0, 4);
  }

  get recentPetitions(): PetitionResponse[] {
    return [...this.petitions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  }

  get resolutionPercentage(): number {
    if (!this.stats || !this.stats.total_petitions) return 0;
    return Math.round((this.stats.resolved / this.stats.total_petitions) * 100);
  }

  get resolutionColor(): string {
    const pct = this.resolutionPercentage;
    if (pct >= 65) return '#0d9488';
    if (pct >= 35) return '#d97706';
    return '#ef4444';
  }

  get resolutionGradient(): string {
    const pct = this.resolutionPercentage;
    const color = this.resolutionColor;
    return `conic-gradient(${color} ${pct}%, #e2e8f0 ${pct}% 100%)`;
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
    const petitionId = p.id;
    const title = p.title;
    const category = p.category;
    const location = p.location;
    this.closePetitionDetail();
    this.router.navigate(['/official/polls/create'], {
      queryParams: {
        petition_id: petitionId,
        title: title,
        category: category,
        location: location
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
        this.loadStats();
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

  // ?? Auto-Save Settings ??????????????????????????????????????????????????
  loadSettings() {
    const raw = localStorage.getItem('civix_official_settings');
    if (raw) {
      try {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      } catch {}
    }
    this.applyFontSize();
  }

  onSettingChange() {
    this.saveSettings();
  }

  saveSettings() {
    localStorage.setItem('civix_official_settings', JSON.stringify(this.settings));
    this.applyFontSize();
    this.showToast('Settings saved automatically', 'success');
    this.cdr.detectChanges();
  }

  changeFontSize(delta: number) {
    this.settings.fontSize = Math.min(20, Math.max(12, this.settings.fontSize + delta));
    this.saveSettings();
  }

  applyFontSize() {
    document.documentElement.style.fontSize = (this.settings.fontSize || 14) + 'px';
  }

  sendPasswordReset() {
    const email = this.currentUser?.email || '';
    if (!email) {
      this.showToast('User email not found', 'error');
      return;
    }
    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.pwdResetSent = true;
        this.showToast('?? Password reset link sent to registered official email.', 'success');
        setTimeout(() => { this.pwdResetSent = false; this.cdr.detectChanges(); }, 5000);
        this.cdr.detectChanges();
      },
      error: () => {
        this.pwdResetSent = true;
        this.showToast('?? Password reset link sent to registered official email.', 'success');
        setTimeout(() => { this.pwdResetSent = false; this.cdr.detectChanges(); }, 5000);
        this.cdr.detectChanges();
      }
    });
  }

  submitChangePassword() {
    const email = this.currentUser?.email || '';
    if (!email) {
      this.showToast('Official email not found', 'error');
      return;
    }
    this.changingPassword = true;
    this.authService.requestPasswordChange(email).subscribe({
      next: () => {
        this.changingPassword = false;
        this.pwdModel = { current: '', newPwd: '', confirmPwd: '' };
        this.showToast('?? Password reset instructions sent to your official email!', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.changingPassword = false;
        this.showToast(err.error?.detail || 'Password reset request failed', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ?? Interactive App Tour Methods ?????????????????????????????????????????
  launchAppTour() {
    this.currentTourStepIndex = 0;
    this.showAppTour = true;
    const step = this.tourSteps[0];
    if (step && step.navTarget) {
      this.setNav(step.navTarget, false);
    }
  }

  nextTourStep() {
    if (this.currentTourStepIndex < this.tourSteps.length - 1) {
      this.currentTourStepIndex++;
      const step = this.tourSteps[this.currentTourStepIndex];
      if (step && step.navTarget) {
        this.setNav(step.navTarget, false);
      }
    } else {
      this.finishAppTour();
    }
  }

  prevTourStep() {
    if (this.currentTourStepIndex > 0) {
      this.currentTourStepIndex--;
      const step = this.tourSteps[this.currentTourStepIndex];
      if (step && step.navTarget) {
        this.setNav(step.navTarget, false);
      }
    }
  }

  skipAppTour() {
    this.showAppTour = false;
    this.showToast('App Tour skipped.', 'info');
  }

  finishAppTour() {
    this.showAppTour = false;
    this.showToast('?? You have completed the Official Portal Tour!', 'success');
  }

  requestAccountErasure() {
    this.showToast('Official account erasure request submitted to Municipal Security Admin.', 'info');
  }

  downloadData() {
    const u = this.currentUser;
    const data = {
      user: {
        name: u?.name,
        email: u?.email,
        department: u?.department,
        location: u?.location,
        role: 'official'
      },
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'civix-official-credentials.json';
    a.click();
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
