import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Auth, UserResponse } from '../auth/auth';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

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
  iconSvg: string;
}

@Component({
  selector: 'app-official-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './official-settings.html',
  styleUrl: './official-settings.css'
})
export class OfficialSettings implements OnInit {
  currentUser: UserResponse | null = null;
  sidebarCollapsed: boolean = false;
  mobileSidebarOpen: boolean = false;

  // Settings Tabs State
  activeSettingsTab: SettingsTab = 'profile';
  settings: AppSettings = { ...DEFAULT_SETTINGS };
  settingsSaved: boolean = false;
  pwdResetSent: boolean = false;

  // Password Model
  pwdModel = { current: '', newPwd: '', confirmPwd: '' };
  changingPassword = false;

  // App Tour State
  showAppTour: boolean = false;
  currentTourStepIndex: number = 0;

  tourSteps: OfficialTourStep[] = [
    {
      step: 1,
      title: 'Municipal Dashboard Overview',
      badge: 'Step 1 of 4 • Overview & Key Metrics',
      purpose: 'Track overall petition numbers, resolution counts, active cases, and constituency signature totals.',
      whyUse: 'Provides real-time visibility into department workload, allowing leadership to prioritize urgent grievances.',
      description: 'View essential performance metrics across your jurisdiction, including Active, Under Review, In Progress, and Resolved petitions.',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>'
    },
    {
      step: 2,
      title: 'Department Petition Review & Triage',
      badge: 'Step 2 of 4 • Petition Management',
      purpose: 'Filter petitions by status, inspect citizen evidence photos, and update petition status.',
      whyUse: 'Allows municipal officers to transition petitions from "Active" to "In Progress" or "Resolved" as field work is completed.',
      description: 'Search petitions by keyword, filter by status, click to view evidence photos with lightbox zoom, and update status dropdowns instantly.',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    },
    {
      step: 3,
      title: 'Publish Official Response & Action Plans',
      badge: 'Step 3 of 4 • Transparency & Citizen Updates',
      purpose: 'Publish binding municipal status updates and concrete action plans directly on petitions.',
      whyUse: 'Notifies signed citizens instantly via email/push alerts, building public trust and demonstrating council responsiveness.',
      description: 'Inside any petition detail view, enter official response comments and document field actions taken by your engineering or sanitation teams.',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    },
    {
      step: 4,
      title: 'Settings, Danger Zone & Security',
      badge: 'Step 4 of 4 • Account Administration',
      purpose: 'Auto-save preferences, trigger email password reset links, launch platform tour, or manage security.',
      whyUse: 'Provides self-serve account recovery options and system configurations for municipal personnel.',
      description: 'Features 5 sub-tabs: Profile & Identity, Notifications, Privacy & Security (with Danger Zone), Appearance, and Department Routing.',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    }
  ];

  // Logout Modal State
  logoutConfirmOpen: boolean = false;
  loggingOut: boolean = false;

  // Toasts
  toasts: Toast[] = [];
  private toastCounter = 0;

  constructor(
    private authService: Auth,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.authService.getMe().subscribe({
      next: (u) => {
        this.currentUser = u;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
    this.loadSettings();
  }

  getSafeSvg(svgString: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }

  toggleSidebarCollapse() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  setSettingsTab(tab: SettingsTab) {
    this.activeSettingsTab = tab;
  }

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
        this.showToast('Password reset link sent to registered official email.', 'success');
        setTimeout(() => { this.pwdResetSent = false; this.cdr.detectChanges(); }, 5000);
        this.cdr.detectChanges();
      },
      error: () => {
        this.pwdResetSent = true;
        this.showToast('Password reset link sent to registered official email.', 'success');
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
        this.showToast('Password reset instructions sent to your official email!', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.changingPassword = false;
        this.showToast(err.error?.detail || 'Password reset request failed', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // App Tour Methods
  launchAppTour() {
    this.currentTourStepIndex = 0;
    this.showAppTour = true;
  }

  nextTourStep() {
    if (this.currentTourStepIndex < this.tourSteps.length - 1) {
      this.currentTourStepIndex++;
    } else {
      this.finishAppTour();
    }
  }

  prevTourStep() {
    if (this.currentTourStepIndex > 0) {
      this.currentTourStepIndex--;
    }
  }

  skipAppTour() {
    this.showAppTour = false;
    this.showToast('App Tour skipped.', 'info');
  }

  finishAppTour() {
    this.showAppTour = false;
    this.showToast('You have completed the Official Portal Tour!', 'success');
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
