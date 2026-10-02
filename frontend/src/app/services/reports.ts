import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DailyTrend {
  day: number;
  submissions: number;
  responses: number;
}

export interface TopPetition {
  id: number;
  title: string;
  category: string;
  status: string;
  signature_count: number;
  signature_goal: number;
  location: string;
  created_at: string;
  official_responses_count?: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  jurisdiction: string;
  department: string;
  monthly_petitions: number;
  monthly_signatures: number;
  monthly_responses: number;
  resolved_this_month: number;
  pending_petitions: number;
  total_petitions_jurisdiction: number;
  avg_response_hours: number | null;
  category_breakdown: Record<string, number>;
  status_distribution: Record<string, number>;
  daily_trend: DailyTrend[];
  top_petitions: TopPetition[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly base = `${environment.apiUrl}/api/reports`;

  constructor(private http: HttpClient) {}

  getMonthlyReport(year: number, month: number): Observable<MonthlyReport> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<MonthlyReport>(`${this.base}/monthly`, { params });
  }

  getCSVExportUrl(year: number, month: number): string {
    const token = localStorage.getItem('civix_token') || '';
    return `${this.base}/export/csv?year=${year}&month=${month}`;
  }

  exportCSV(year: number, month: number): Observable<Blob> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get(`${this.base}/export/csv`, { params, responseType: 'blob' });
  }
}
