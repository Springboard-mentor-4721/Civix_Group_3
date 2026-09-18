import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, UserResponse } from '../auth/auth';
import { PetitionService, PetitionResponse, PetitionStatus, DashboardStats, OfficialResponse } from '../services/petition';

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }
type NavSection = 'overview' | 'petitions' | 'profile' | 'settings';

interface AppSettings {
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
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light', language: 'en', fontSize: 14, compactMode: false, animations: true,
  emailNotifs: true, pushNotifs: false, petitionUpdates: true, responseAlerts: true, weeklyDigest: false,
  profileVisibility: 'public', activityStatus: true, dataSharing: false
};

@Component({
  selector: 'app-official-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './official-dashboard.html',
  styleUrl: './official-dashboard.css'
})
export class OfficialDashboard implements OnInit {
  currentUser: UserResponse | null = null;
  activeNav: NavSection = 'overview';

  stats: DashboardStats | null = null;
  loadingStats = false;

  petitions: PetitionResponse[] = [];
  loadingPetitions = false;
  selectedStatus = 'all';
  searchQuery = '';
  updatingStatusId: number | null = null;
  statusUpdates: Record<number, PetitionStatus> = {};

  selectedPetition: any = null;
  loadingDetail = false;
  responseText = '';
  actionTaken = '';
  submittingResponse = false;

  logoutConfirmOpen = false;
  loggingOut = false;
  mobileSidebarOpen = false;
  toasts: Toast[] = [];
  private toastCounter = 0;

  settings: AppSettings = { ...DEFAULT_SETTINGS };
  settingsSaved = false;
  pwdResetSent = false;

  statuses = [
    { label: 'All',          value: 'all' },
    { label: 'Active',       value: 'active' },
    { label: 'Under Review', value: 'under_review' },
    { label: 'In Progress',  value: 'in_progress' },
    { label: 'Resolved',     value: 'resolved' },
    { label: 'Closed',       value: 'closed' },
  ];

  constructor(
    private authService: Auth,
    private petitionService: PetitionService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.authService.getMe().subscribe({ next: (u) => { this.currentUser = u; this.cdr.detectChanges(); }, error: () => {} });
    this.loadStats();
    this.loadPetitions();
    this.loadSettings();
  }

  setNav(nav: NavSection) {
    this.activeNav = nav;
    this.mobileSidebarOpen = false;
    this.selectedPetition = null;
    if (nav === 'overview')  this.loadStats();
    if (nav === 'petitions') this.loadPetitions();
  }

  loadStats() {
    this.loadingStats = true;
    this.petitionService.getOfficialDashboard().subscribe({
      next: (s) => { this.stats = s; this.loadingStats = false; this.cdr.detectChanges(); },
      error: () => { this.loadingStats = false; }
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
        this.cdr.detectChanges();
      },
      error: () => { this.loadingPetitions = false; this.showToast('Failed to load petitions', 'error'); }
    });
  }

  get filteredPetitions(): PetitionResponse[] {
    if (!this.searchQuery.trim()) return this.petitions;
    const q = this.searchQuery.toLowerCase();
    return this.petitions.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  openPetitionDetail(p: PetitionResponse) {
    this.loadingDetail = true;
    this.selectedPetition = p;
    this.responseText = '';
    this.actionTaken = '';
    this.petitionService.getPetition(p.id).subscribe({
      next: (detail) => { this.selectedPetition = detail; this.loadingDetail = false; this.cdr.detectChanges(); },
      error: () => { this.loadingDetail = false; }
    });
  }

  updateStatus(petition: PetitionResponse) {
    const newStatus = this.statusUpdates[petition.id];
    if (!newStatus || newStatus === petition.status) return;
    this.updatingStatusId = petition.id;
    this.petitionService.updatePetitionStatus(petition.id, newStatus).subscribe({
      next: (updated) => {
        petition.status = updated.status;
        this.statusUpdates[petition.id] = updated.status;
        if (this.selectedPetition?.id === petition.id) this.selectedPetition.status = updated.status;
        this.updatingStatusId = null;
        this.showToast(`Status → ${this.getStatusLabel(updated.status)}`, 'success');
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
        if (!this.selectedPetition.official_responses) this.selectedPetition.official_responses = [];
        this.selectedPetition.official_responses.unshift(resp);
        this.showToast('Response submitted successfully', 'success');
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
      active: 'Active', under_review: 'Under Review',
      in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed'
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

  // ── Settings ──────────────────────────────────────────────────────────
  loadSettings() {
    const raw = localStorage.getItem('civix_settings');
    if (raw) { try { this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch {} }
    this.applyFontSize();
  }

  saveSettings() {
    localStorage.setItem('civix_settings', JSON.stringify(this.settings));
    this.applyFontSize();
    this.settingsSaved = true;
    setTimeout(() => { this.settingsSaved = false; this.cdr.detectChanges(); }, 2000);
    this.cdr.detectChanges();
  }

  setSetting(key: keyof AppSettings, value: any) { (this.settings as any)[key] = value; this.saveSettings(); }

  changeFontSize(delta: number) {
    this.settings.fontSize = Math.min(20, Math.max(12, this.settings.fontSize + delta));
    this.saveSettings();
  }

  applyFontSize() { document.documentElement.style.fontSize = this.settings.fontSize + 'px'; }

  sendPasswordReset() {
    const email = this.currentUser?.email || '';
    this.authService.forgotPassword(email).subscribe({
      next: () => { this.pwdResetSent = true; setTimeout(() => { this.pwdResetSent = false; this.cdr.detectChanges(); }, 5000); this.cdr.detectChanges(); },
      error: () => { this.pwdResetSent = true; setTimeout(() => { this.pwdResetSent = false; this.cdr.detectChanges(); }, 5000); this.cdr.detectChanges(); }
    });
  }

  downloadData() {
    const u = this.currentUser;
    const data = { user: { name: u?.name, email: u?.email, department: u?.department, location: u?.location, role: 'official' }, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'civix-official-data.json'; a.click();
  }

  restartTour() { localStorage.removeItem('civix_tour_done'); alert('Tour will start on next page load.'); }

  deactivateAccount() {
    if (confirm('Deactivate your account? You can reactivate by logging in again.')) {
      this.authService.logout().subscribe(() => this.router.navigate(['/login']));
    }
  }

  deleteAccount() {
    if (confirm('PERMANENTLY delete your account? This cannot be undone.')) {
      alert('Account deletion request submitted. Our team will process it within 48 hours.');
    }
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message, type });
    setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); this.cdr.detectChanges(); }, 4000);
  }

  dismissToast(id: number) { this.toasts = this.toasts.filter(t => t.id !== id); }
}
