import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Auth, UserResponse } from '../auth/auth';
import { ReportsService, MonthlyReport } from '../services/reports';
import { PetitionService, PetitionResponse } from '../services/petition';

export type ReportView = 'hub' | 'petition-report' | 'petition-analysis' | 'all-report' | 'all-analysis';

const VIEW_LABELS: Record<ReportView, string> = {
  'hub': 'Reports Hub',
  'petition-report': 'Reports / Petition Report',
  'petition-analysis': 'Reports / Petition Analysis',
  'all-report': 'Reports / All Report',
  'all-analysis': 'Reports / All Analysis',
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class Reports implements OnInit {
  activeView: ReportView = 'hub';
  report: MonthlyReport | null = null;
  currentDate = new Date();
  loading = false;
  errorMessage = '';
  exportingCSV = false;
  exportingPDF = false;

  selectedYear: number;
  selectedMonth: number;
  years: number[] = [];
  months = [
    { value: 1,  label: 'January' },  { value: 2,  label: 'February' },
    { value: 3,  label: 'March' },    { value: 4,  label: 'April' },
    { value: 5,  label: 'May' },      { value: 6,  label: 'June' },
    { value: 7,  label: 'July' },     { value: 8,  label: 'August' },
    { value: 9,  label: 'September' },{ value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  // Petition selector
  petitions: PetitionResponse[] = [];
  selectedPetitionId: string = '';
  selectedPetition: any = null;
  loadingDetail = false;

  // Email state
  sendingEmail = false;
  emailSentMessage = '';
  emailErrorMessage = '';

  // Shell & User State
  sidebarCollapsed = false;
  mobileSidebarOpen = false;
  logoutConfirmOpen = false;
  loggingOut = false;
  currentUser: UserResponse | null = null;
  userName = 'Official';
  userDepartment = 'Municipal Department';
  userProfilePic: string | null = null;

  constructor(
    private reportsService: ReportsService,
    private petitionService: PetitionService,
    private authService: Auth,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    const now = new Date();
    this.selectedYear  = now.getFullYear();
    this.selectedMonth = now.getMonth() + 1;
    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
      this.years.push(y);
    }
  }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    if (this.currentUser) {
      this.userName = this.currentUser.name || 'Official';
      this.userDepartment = this.currentUser.department || 'Municipal Department';
      this.userProfilePic = this.currentUser.profile_picture_url || null;
    }
    this.authService.getMe().subscribe({
      next: (u) => {
        this.currentUser = u;
        if (u) {
          this.userName = u.name || this.userName;
          this.userDepartment = u.department || this.userDepartment;
          this.userProfilePic = u.profile_picture_url || null;
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    this.route.params.subscribe(params => {
      const typeParam = params['type'];
      const titleParam = params['title'];
      if (typeParam) {
        const decodedType = decodeURIComponent(typeParam).toLowerCase();
        if (decodedType.includes('petition report')) this.activeView = 'petition-report';
        else if (decodedType.includes('petition analysis')) this.activeView = 'petition-analysis';
        else if (decodedType.includes('all report')) this.activeView = 'all-report';
        else if (decodedType.includes('all analysis')) this.activeView = 'all-analysis';
      }
      this.loadPetitions(titleParam);
    });
  }

  openView(view: ReportView, petitionId?: number) {
    this.activeView = view;
    if (view === 'all-report' || view === 'all-analysis') {
      this.selectedPetition = null;
      this.selectedPetitionId = '';
      this.loadReport();
    } else if (view === 'petition-report' || view === 'petition-analysis') {
      if (petitionId) {
        this.selectedPetitionId = String(petitionId);
        this.onPetitionSelect();
      } else {
        this.selectedPetition = null;
        this.selectedPetitionId = '';
      }
    } else {
      this.selectedPetition = null;
      this.selectedPetitionId = '';
    }
    this.updateBrowserUrl();
    this.cdr.detectChanges();
  }

  selectPetition(p: any) {
    if (!p) return;
    this.selectedPetitionId = String(p.id);
    this.selectedPetition = p;
    this.onPetitionSelect();
  }

  clearSelectedPetition() {
    this.selectedPetitionId = '';
    this.selectedPetition = null;
    this.updateBrowserUrl();
    this.cdr.detectChanges();
  }

  sendReportToCreator() {
    if (!this.selectedPetition?.id) return;
    this.sendingEmail = true;
    this.emailSentMessage = '';
    this.emailErrorMessage = '';
    this.petitionService.sendReportEmail(this.selectedPetition.id).subscribe({
      next: (res) => {
        this.sendingEmail = false;
        this.emailSentMessage = res.message || 'Report email sent successfully to petition creator!';
        this.cdr.detectChanges();
        setTimeout(() => { this.emailSentMessage = ''; this.cdr.detectChanges(); }, 5000);
      },
      error: (err) => {
        this.sendingEmail = false;
        this.emailErrorMessage = err?.error?.detail || 'Failed to send report email.';
        this.cdr.detectChanges();
        setTimeout(() => { this.emailErrorMessage = ''; this.cdr.detectChanges(); }, 5000);
      }
    });
  }

  getViewTitle(view: ReportView): string {
    switch (view) {
      case 'petition-report': return 'Petition Report';
      case 'petition-analysis': return 'Petition Analysis';
      case 'all-report': return 'All Report';
      case 'all-analysis': return 'All Analysis';
      default: return 'Reports Hub';
    }
  }

  get currentRoutePath(): string {
    const title = this.getViewTitle(this.activeView);
    const petTitle = this.selectedPetition?.title ? ` / ${this.selectedPetition.title}` : '';
    return `/reports / ${title}${petTitle}`;
  }

  updateBrowserUrl() {
    if (this.activeView === 'hub') {
      this.location.go('/official/reports');
      return;
    }
    const cardTitle = this.getViewTitle(this.activeView);
    let url = `/reports/${encodeURIComponent(cardTitle)}`;
    if (this.selectedPetition?.title) {
      url += `/${encodeURIComponent(this.selectedPetition.title)}`;
    }
    this.location.go(url);
  }

  loadPetitions(initialTitleMatch?: string) {
    this.petitionService.getOfficialPetitions({ page: 1, per_page: 200 }).subscribe({
      next: (res) => {
        this.petitions = res.petitions || [];
        if (initialTitleMatch) {
          const decoded = decodeURIComponent(initialTitleMatch).toLowerCase();
          const match = this.petitions.find(p => p.title.toLowerCase() === decoded);
          if (match) {
            this.selectedPetitionId = String(match.id);
            this.onPetitionSelect();
            return;
          }
        }
        if ((this.activeView === 'petition-report' || this.activeView === 'petition-analysis') && this.petitions.length > 0 && !this.selectedPetitionId) {
          this.selectedPetitionId = String(this.petitions[0].id);
          this.onPetitionSelect();
        } else {
          this.updateBrowserUrl();
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  onPetitionSelect() {
    if (!this.selectedPetitionId) {
      this.selectedPetition = null;
      this.updateBrowserUrl();
      return;
    }
    this.loadingDetail = true;
    this.petitionService.getPetition(Number(this.selectedPetitionId)).subscribe({
      next: (p) => {
        this.selectedPetition = p;
        this.loadingDetail = false;
        this.updateBrowserUrl();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingDetail = false;
        this.updateBrowserUrl();
        this.cdr.detectChanges();
      }
    });
  }

  loadReport() {
    this.loading = true;
    this.errorMessage = '';
    this.reportsService.getMonthlyReport(this.selectedYear, this.selectedMonth).subscribe({
      next: (r) => {
        this.ngZone.run(() => {
          this.report = r;
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loading = false;
          this.errorMessage = err?.error?.detail || 'Failed to load report.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  onPeriodChange() { this.loadReport(); }

  get monthLabel(): string {
    return this.months.find(m => m.value === Number(this.selectedMonth))?.label || '';
  }

  get categoryEntries(): { key: string; value: number; pct: number }[] {
    if (!this.report?.category_breakdown) return [];
    const total = Object.values(this.report.category_breakdown).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(this.report.category_breakdown)
      .map(([key, value]) => ({ key, value, pct: Math.round((value / total) * 100) }))
      .sort((a, b) => b.value - a.value);
  }

  get statusEntries(): { key: string; value: number; pct: number }[] {
    if (!this.report?.status_distribution) return [];
    const total = Object.values(this.report.status_distribution).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(this.report.status_distribution)
      .map(([key, value]) => ({ key, value, pct: Math.round((value / total) * 100) }))
      .sort((a, b) => b.value - a.value);
  }

  get maxDailyValue(): number {
    if (!this.report?.daily_trend?.length) return 1;
    return Math.max(...this.report.daily_trend.map(d => Math.max(d.submissions, d.responses)), 1);
  }

  barHeight(value: number): number {
    return this.maxDailyValue > 0 ? Math.max(4, Math.round((value / this.maxDailyValue) * 100)) : 4;
  }

  getPct(current: number, goal: number): number {
    if (!goal) return 0;
    return Math.min(100, Math.round((current / goal) * 100));
  }

  getDaysSince(dateStr: string): number {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  statusLabel(key: string): string {
    const map: Record<string, string> = {
      active: 'Active', under_review: 'Under Review',
      in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed'
    };
    return map[key] || key;
  }

  getStatusLabel(key: string): string { return this.statusLabel(key); }

  statusClass(key: string): string {
    const map: Record<string, string> = {
      active: 'st-active', under_review: 'st-review',
      in_progress: 'st-progress', resolved: 'st-resolved', closed: 'st-closed'
    };
    return map[key] || '';
  }

  categoryColor(key: string): string {
    const map: Record<string, string> = {
      'Environment': '#10b981', 'Infrastructure': '#3b82f6',
      'Education': '#8b5cf6', 'Public Safety': '#ef4444',
      'Transportation': '#f59e0b', 'Healthcare': '#ec4899',
      'Housing': '#06b6d4', 'General': '#64748b'
    };
    return map[key] || '#94a3b8';
  }

  // ── Downloads ──────────────────────────────────────────────

  downloadPDF(type: string) {
    this.exportingPDF = true;
    setTimeout(() => { window.print(); this.exportingPDF = false; this.cdr.detectChanges(); }, 300);
  }

  downloadCSV(type: string) {
    if (type === 'petition-analysis' && this.selectedPetition) {
      const p = this.selectedPetition;
      const rows = [
        ['Field', 'Value'],
        ['Title', p.title],
        ['Category', p.category],
        ['Location', p.location],
        ['Status', this.statusLabel(p.status)],
        ['Signatures', p.signature_count],
        ['Goal', p.signature_goal],
        ['Progress %', this.getPct(p.signature_count, p.signature_goal)],
        ['Responses', p.official_responses?.length || 0],
        ['Days Since Filed', this.getDaysSince(p.created_at)],
        ['Filed On', p.created_at],
      ];
      this.triggerCSVDownload(rows, `petition_analysis_${p.id}`);
      return;
    }
    this.exportCSV();
  }

  exportCSV() {
    this.exportingCSV = true;
    this.reportsService.exportCSV(this.selectedYear, this.selectedMonth).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `civix_report_${this.selectedYear}_${String(this.selectedMonth).padStart(2, '0')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportingCSV = false;
        this.cdr.detectChanges();
      },
      error: () => { this.exportingCSV = false; this.cdr.detectChanges(); }
    });
  }

  exportPDF() {
    this.exportingPDF = true;
    setTimeout(() => { window.print(); this.exportingPDF = false; this.cdr.detectChanges(); }, 300);
  }

  private triggerCSVDownload(rows: any[][], filename: string) {
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
    this.exportingCSV = false;
    this.cdr.detectChanges();
  }

  // ── Sidebar ────────────────────────────────────────────────
  toggleSidebarCollapse(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
  toggleMobileSidebar(): void { this.mobileSidebarOpen = !this.mobileSidebarOpen; }
  promptLogout(): void { this.logoutConfirmOpen = true; }
  cancelLogout(): void { this.logoutConfirmOpen = false; }

  confirmLogout(): void {
    this.loggingOut = true;
    this.authService.logout().subscribe({
      next: () => { this.loggingOut = false; this.logoutConfirmOpen = false; this.router.navigate(['/login']); },
      error: () => { this.loggingOut = false; this.logoutConfirmOpen = false; this.router.navigate(['/login']); }
    });
  }
}
