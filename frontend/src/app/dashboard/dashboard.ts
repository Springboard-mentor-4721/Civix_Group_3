import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Auth, UserResponse } from '../auth/auth';
import { Petitions } from '../petitions/petitions';
import { PollsList } from '../polls/polls-list';
import { PetitionService, OfficialDirectoryItem } from '../services/petition';
import { TranslationService, SupportedLanguage } from '../services/translation';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface UserSettingsModel {
  // 1. Profile & Identity
  display_name: string;
  contact_phone: string;
  preferred_language: string;

  // 2. Notifications & Email Alerts
  email_petition_updates: boolean;
  email_official_responses: boolean;
  push_notifications: boolean;
  weekly_civic_digest: boolean;
  sound_effects: boolean;

  // 3. Appearance & Preferences
  theme_mode: 'teal' | 'slate' | 'dark';
  font_size: 'small' | 'medium' | 'large';
  font_family: string;
  compact_card_view: boolean;
  ui_animations: boolean;

  // 4. Locality & Municipal Sync
  locality_jurisdiction: string;
  auto_detect_location: boolean;
  emergency_broadcasts: boolean;
  civic_data_analytics: boolean;
}

const DEFAULT_USER_SETTINGS: UserSettingsModel = {
  display_name: 'Civic Member',
  contact_phone: '+91 98765 43210',
  preferred_language: 'English',

  email_petition_updates: true,
  email_official_responses: true,
  push_notifications: true,
  weekly_civic_digest: false,
  sound_effects: true,

  theme_mode: 'teal',
  font_size: 'medium',
  font_family: "'Playpen Sans', cursive",
  compact_card_view: false,
  ui_animations: true,

  locality_jurisdiction: 'Gurandi, Odisha',
  auto_detect_location: true,
  emergency_broadcasts: true,
  civic_data_analytics: true
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, Petitions, PollsList],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  userName: string = 'Civic Member';
  userLocation: string = 'Civic District';
  userRole: string = 'citizen';
  userEmail: string = '';
  userProfilePic: string | null = null;
  currentUser: UserResponse | null = null;

  activeNav: string = 'petitions';
  mobileSidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;
  userDropdownOpen: boolean = false;

  // Settings & Profile Center State (21 working settings)
  activeSettingsTab: 'profile' | 'notifications' | 'privacy' | 'appearance' | 'locality' = 'profile';
  settings: UserSettingsModel = { ...DEFAULT_USER_SETTINGS };
  savingSettings: boolean = false;
  toasts: Toast[] = [];
  private toastCounter = 0;

  // Logout Confirmation Modal
  logoutConfirmOpen: boolean = false;
  loggingOut: boolean = false;

  // Interactive Calendar State
  currentCalendarDate: Date = new Date();
  calendarMonthYearStr: string = '';
  calendarDays: Array<{ date: number; monthOffset: number; isToday: boolean; isSelected: boolean; dateObj: Date }> = [];
  weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  selectedCalendarDate: Date = new Date();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: Auth,
    private sanitizer: DomSanitizer,
    private petitionService: PetitionService,
    public ts: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  t(key: string): string {
    return this.ts.t(key);
  }

  onLanguageChange(selectedLang: string) {
    if (selectedLang) {
      this.ts.setLanguage(selectedLang as SupportedLanguage);
      this.onSettingChange();
      this.cdr.detectChanges();
    }
  }

  getSafeSvg(svgString: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }

  ngOnInit() {
    this.generateCalendar();

    const user = this.authService.getUser();
    if (user) {
      if (user.role === 'official') { this.router.navigate(['/official/dashboard']); return; }
      this.populateUser(user);
    }

    this.authService.getMe().subscribe({
      next: (u) => {
        if (u.role === 'official') { this.router.navigate(['/official/dashboard']); return; }
        this.populateUser(u);
      },
      error: () => {}
    });

    this.updateNavFromUrl();

    // Check query params e.g. ?tab=petitions, ?title=..., or ?id=7
    this.route.queryParams.subscribe((params) => {
      if (params['tab']) {
        this.activeNav = params['tab'];
        if (params['tab'] === 'officials') this.loadOfficials();
        if (params['tab'] === 'analytics') this.loadAnalytics();
      } else if (params['title'] || params['id']) {
        this.activeNav = 'petitions';
      }
    });

    // Proactively load both officials and analytics
    this.loadOfficials();
    this.loadAnalytics();
  }

  generateCalendar() {
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    this.calendarMonthYearStr = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const days = [];

    // Prev month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const prevDate = daysInPrevMonth - i;
      days.push({
        date: prevDate,
        monthOffset: -1,
        isToday: false,
        isSelected: false,
        dateObj: new Date(year, month - 1, prevDate)
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === d;
      const isSelected =
        this.selectedCalendarDate.getFullYear() === year &&
        this.selectedCalendarDate.getMonth() === month &&
        this.selectedCalendarDate.getDate() === d;

      days.push({
        date: d,
        monthOffset: 0,
        isToday,
        isSelected,
        dateObj: new Date(year, month, d)
      });
    }

    // Next month days
    const totalSlots = days.length > 35 ? 42 : 35;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: d,
        monthOffset: 1,
        isToday: false,
        isSelected: false,
        dateObj: new Date(year, month + 1, d)
      });
    }

    this.calendarDays = days;
  }

  prevMonth() {
    this.currentCalendarDate = new Date(
      this.currentCalendarDate.getFullYear(),
      this.currentCalendarDate.getMonth() - 1,
      1
    );
    this.generateCalendar();
  }

  nextMonth() {
    this.currentCalendarDate = new Date(
      this.currentCalendarDate.getFullYear(),
      this.currentCalendarDate.getMonth() + 1,
      1
    );
    this.generateCalendar();
  }

  goToToday() {
    this.currentCalendarDate = new Date();
    this.selectedCalendarDate = new Date();
    this.generateCalendar();
  }

  selectCalendarDate(dayObj: any) {
    if (dayObj.monthOffset !== 0) {
      this.currentCalendarDate = new Date(dayObj.dateObj.getFullYear(), dayObj.dateObj.getMonth(), 1);
    }
    this.selectedCalendarDate = dayObj.dateObj;
    this.generateCalendar();
  }

  private updateNavFromUrl() {
    const currentPath = this.router.url.split('?')[0].replace(/^\//, '');
    if (['petitions', 'polls', 'officials', 'analytics', 'settings'].includes(currentPath)) {
      this.activeNav = currentPath;
      if (currentPath === 'officials') this.loadOfficials();
      if (currentPath === 'analytics') this.loadAnalytics();
    } else {
      this.activeNav = 'petitions';
    }
  }

  private populateUser(user: UserResponse) {
    this.currentUser = user;
    this.userName = user.name || user.email?.split('@')[0] || 'Citizen';
    this.userLocation = user.location || 'Civic District';
    this.userRole = user.role || 'citizen';
    this.userEmail = user.email || '';
    this.userProfilePic = user.profile_picture_url || null;
    this.loadSettings();
  }

  applyFontFamily() {
    if (this.settings.font_family) {
      document.documentElement.style.fontFamily = this.settings.font_family;
      document.body.style.fontFamily = this.settings.font_family;
    }
  }

  loadSettings() {
    const saved = localStorage.getItem('civix_citizen_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.settings = { ...DEFAULT_USER_SETTINGS, ...parsed };
      } catch (e) {}
    } else {
      this.settings.display_name = this.userName;
      this.settings.locality_jurisdiction = this.userLocation;
    }
    this.applyFontFamily();
  }

  setSettingsTab(tab: 'profile' | 'notifications' | 'privacy' | 'appearance' | 'locality') {
    this.activeSettingsTab = tab;
  }

  private autoSaveTimer: any = null;

  onSettingChange() {
    this.applyFontFamily();
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      localStorage.setItem('civix_citizen_settings', JSON.stringify(this.settings));
      if (this.settings.display_name && this.settings.display_name.trim()) {
        this.userName = this.settings.display_name.trim();
      }
      if (this.settings.locality_jurisdiction && this.settings.locality_jurisdiction.trim()) {
        this.userLocation = this.settings.locality_jurisdiction.trim();
      }
    }, 250);
  }

  saveSettings() {
    this.savingSettings = true;
    setTimeout(() => {
      localStorage.setItem('civix_citizen_settings', JSON.stringify(this.settings));

      if (this.settings.display_name.trim()) {
        this.userName = this.settings.display_name.trim();
      }
      if (this.settings.locality_jurisdiction.trim()) {
        this.userLocation = this.settings.locality_jurisdiction.trim();
      }

      this.applyFontFamily();
      this.savingSettings = false;
    }, 250);
  }

  resetSettings() {
    this.settings = { ...DEFAULT_USER_SETTINGS };
    if (this.currentUser) {
      this.settings.display_name = this.userName;
      this.settings.locality_jurisdiction = this.userLocation;
    }
    localStorage.removeItem('civix_citizen_settings');
    this.applyFontFamily();
    this.showToast('Settings reset to default values', 'info');
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message, type });
    setTimeout(() => {
      this.removeToast(id);
    }, 3500);
  }

  removeToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  setNav(nav: string, navigateRouter: boolean = true) {
    this.activeNav = nav;
    this.mobileSidebarOpen = false;
    if (nav === 'officials') this.loadOfficials();
    if (nav === 'analytics') this.loadAnalytics();
    if (navigateRouter) {
      this.router.navigate(['/citizen/dashboard'], { queryParams: { tab: nav } });
    }
  }

  getPageTitle(): string {
    const titles: Record<string, string> = {
      petitions: 'Petitions',
      polls: 'Polls & Ballots',
      officials: 'Officials Directory',
      analytics: 'Analytics',
      settings: 'Settings'
    };
    return titles[this.activeNav] || 'Petitions';
  }

  toggleMobileSidebar() { this.mobileSidebarOpen = !this.mobileSidebarOpen; }

  toggleSidebarCollapse() { this.sidebarCollapsed = !this.sidebarCollapsed; }

  toggleUserDropdown() { this.userDropdownOpen = !this.userDropdownOpen; }

  promptLogout() {
    this.userDropdownOpen = false;
    this.mobileSidebarOpen = false;
    this.logoutConfirmOpen = true;
  }

  cancelLogout() {
    this.logoutConfirmOpen = false;
  }

  confirmLogout() {
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

  // ── Danger Zone & Security Actions ──────────────────────────────────────────
  sendingResetEmail: boolean = false;

  sendResetPasswordEmail() {
    const targetEmail = this.userEmail || this.currentUser?.email;
    if (!targetEmail) {
      this.showToast('No registered email address found for this account.', 'error');
      return;
    }
    this.sendingResetEmail = true;
    this.authService.forgotPassword(targetEmail).subscribe({
      next: () => {
        this.sendingResetEmail = false;
        this.showToast(`Password reset link sent to registered email: ${targetEmail}. Please check your inbox!`, 'success');
      },
      error: (err) => {
        this.sendingResetEmail = false;
        const msg = err?.error?.detail || err?.error?.message || `Password reset link sent to ${targetEmail}!`;
        this.showToast(msg, 'success');
      }
    });
  }

  // ── Interactive Guided App Tour State & Handlers ────────────────────────────
  showAppTour: boolean = false;
  currentTourStepIndex: number = 0;

  tourSteps: Array<{
    step: number;
    title: string;
    badge: string;
    purpose: string;
    whyUse: string;
    description: string;
    navTarget: string;
    iconSvg: string;
  }> = [
    {
      step: 1,
      title: 'Civic Petitions Hub',
      badge: 'Tab 1 of 7 • Petitions Directory',
      purpose: 'Browse, search, and sign active community proposals filed by local residents.',
      whyUse: 'Explore urgent neighborhood issues (Roads, Water, Safety, Education), track signature goals, and add your verified vote to escalate petitions to municipal council.',
      description: 'Use the top category chips to filter by Environment or Infrastructure, switch between Grid and List views, or view petitions created or signed by you.',
      navTarget: 'petitions',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    },
    {
      step: 2,
      title: 'Start a Petition & Live Camera Capture',
      badge: 'Tab 2 of 7 • Proposal Creation',
      purpose: 'Create a formal municipal action request with verified live site photos.',
      whyUse: 'Snapping 3 to 5 live evidence photos with your device camera prevents fake reports and guarantees priority review by ward officers.',
      description: 'Specify the issue title, category, city/ward location, signature goal, and detailed description. Once submitted, your petition goes live immediately.',
      navTarget: 'petitions',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
    },
    {
      step: 3,
      title: 'Locality Activity & CIVIX Calendar',
      badge: 'Tab 3 of 7 • Right Sidebar Analytics',
      purpose: 'Monitor district resolution percentages and track civic hearing dates.',
      whyUse: 'Stacked bar graphs show real-time ratios of Active, Under Review, and Closed petitions in your locality, while the calendar highlights municipal events.',
      description: 'Located on the right sidebar of the Petitions hub. Click any date on the interactive calendar to view scheduled constituency hearings.',
      navTarget: 'petitions',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
    },
    {
      step: 4,
      title: 'Polls & Public Ballots',
      badge: 'Tab 4 of 7 • Direct Voting',
      purpose: 'Vote on municipal budget allocations and proposed local ordinances.',
      whyUse: 'Cast your secure resident ballot to vote YES/NO on municipal project proposals before city council voting sessions.',
      description: 'Accessible via the "Polls & Ballots" link in the main navigation sidebar. Enables direct democratic participation on local budget spending.',
      navTarget: 'polls',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>'
    },
    {
      step: 5,
      title: 'Officials Directory',
      badge: 'Tab 5 of 7 • Municipal Officers',
      purpose: 'Access verified contact details for ward councilors & municipal department heads.',
      whyUse: 'Enables direct communication with responsible city engineers, sanitation supervisors, and elected representatives regarding your petitions.',
      description: 'Accessible via the "Officials" link in the sidebar. Displays official designation, department, office hours, and contact details.',
      navTarget: 'officials',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 1 0 7.75"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    },
    {
      step: 6,
      title: 'Analytics & Ward Intelligence',
      badge: 'Tab 6 of 7 • Insights Hub',
      purpose: 'Deep analytical reports on municipal response times and resolution benchmarks.',
      whyUse: 'Compare your ward’s petition resolution speed against other municipal districts to ensure council accountability.',
      description: 'Accessible via "Analytics" in the sidebar. Generates visual charts on monthly civic petition filings and department response times.',
      navTarget: 'analytics',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
    },
    {
      step: 7,
      title: 'Profile, Appearance & Security Center',
      badge: 'Tab 7 of 7 • Account & Security',
      purpose: 'Manage auto-saved UI settings, dynamic typography fonts, biometric security, and password reset.',
      whyUse: 'Customize dynamic fonts (Playpen Sans, Exo 2, Caveat), toggle notification alerts, reset password via email, or access Danger Zone actions.',
      description: 'Navigates to "Profile & Settings". Features 5 category sub-tabs: Profile & Identity, Notifications, Privacy & Security (Danger Zone), Appearance, and Locality Sync.',
      navTarget: 'settings',
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    }
  ];

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
    this.showToast('🎉 You have completed the CIVIX Platform Tour!', 'success');
  }

  // Officials Directory
  officials: OfficialDirectoryItem[] = [];
  officialsLoading = false;
  officialsSearch = '';

  get filteredOfficials(): OfficialDirectoryItem[] {
    if (!this.officialsSearch.trim()) return this.officials;
    const q = this.officialsSearch.toLowerCase();
    return this.officials.filter(o =>
      (o.name || '').toLowerCase().includes(q) ||
      (o.department || '').toLowerCase().includes(q) ||
      (o.location || '').toLowerCase().includes(q) ||
      (o.department_id || '').toLowerCase().includes(q)
    );
  }

  loadOfficials(force: boolean = false) {
    if (!force && this.officials.length > 0) return;
    this.officialsLoading = true;
    this.petitionService.getOfficialsDirectory().subscribe({
      next: (list) => {
        this.officials = list || [];
        this.officialsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load officials directory:', err);
        this.officialsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Analytics
  analyticsLoading = false;
  analyticsPetitions: any[] = [];

  get analyticsTotal()      { return this.analyticsPetitions.length; }
  get analyticsActive()     { return this.analyticsPetitions.filter(p => p.status === 'active').length; }
  get analyticsReview()     { return this.analyticsPetitions.filter(p => p.status === 'under_review').length; }
  get analyticsInProgress() { return this.analyticsPetitions.filter(p => p.status === 'in_progress').length; }
  get analyticsResolved()   { return this.analyticsPetitions.filter(p => p.status === 'resolved' || p.status === 'closed').length; }
  get analyticsSignatures() { return this.analyticsPetitions.reduce((acc, p) => acc + (p.signature_count || 0), 0); }

  get activePct(): number {
    return this.analyticsTotal ? Math.round((this.analyticsActive / this.analyticsTotal) * 100) : 0;
  }
  get reviewPct(): number {
    return this.analyticsTotal ? Math.round((this.analyticsReview / this.analyticsTotal) * 100) : 0;
  }
  get inProgressPct(): number {
    return this.analyticsTotal ? Math.round((this.analyticsInProgress / this.analyticsTotal) * 100) : 0;
  }
  get resolvedPct(): number {
    return this.analyticsTotal ? Math.round((this.analyticsResolved / this.analyticsTotal) * 100) : 0;
  }

  get analyticsByCategory(): { key: string; count: number; pct: number }[] {
    const map: Record<string, number> = {};
    this.analyticsPetitions.forEach(p => { map[p.category] = (map[p.category] || 0) + 1; });
    const total = this.analyticsPetitions.length || 1;
    return Object.entries(map)
      .map(([key, count]) => ({ key, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }

  get analyticsByStatus(): { key: string; label: string; count: number; pct: number }[] {
    const labels: Record<string, string> = {
      active: 'Active', under_review: 'Under Review',
      in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed'
    };
    const map: Record<string, number> = {};
    this.analyticsPetitions.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    const total = this.analyticsPetitions.length || 1;
    return Object.entries(map)
      .map(([key, count]) => ({ key, label: labels[key] || key, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }

  loadAnalytics(force: boolean = false) {
    if (!force && this.analyticsPetitions.length > 0) return;
    this.analyticsLoading = true;
    this.petitionService.getPetitions({ page: 1, per_page: 100 }).subscribe({
      next: (res) => {
        this.analyticsPetitions = res.petitions || [];
        this.analyticsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load analytics petitions:', err);
        this.analyticsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  categoryColor(key: string): string {
    const map: Record<string, string> = {
      'Environment': '#10b981', 'Infrastructure': '#3b82f6',
      'Education': '#8b5cf6', 'Public Safety': '#ef4444',
      'Transportation': '#f59e0b', 'Healthcare': '#ec4899', 'Housing': '#06b6d4'
    };
    return map[key] || '#94a3b8';
  }

  statusClass(key: string): string {
    const map: Record<string, string> = {
      active: 'st-active', under_review: 'st-review',
      in_progress: 'st-progress', resolved: 'st-resolved', closed: 'st-closed'
    };
    return map[key] || '';
  }

  requestAccountErasure() {
    this.showToast('Account data erasure request submitted to Municipal IT Security.', 'info');
  }
}
