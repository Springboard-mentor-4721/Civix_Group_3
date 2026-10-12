import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type PetitionCategory =
  | 'Infrastructure'
  | 'Environment'
  | 'Public Safety'
  | 'Transportation'
  | 'Education'
  | 'Healthcare'
  | 'Housing'
  | 'Other';

export type PetitionStatus =
  | 'active'
  | 'under_review'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface PetitionUser {
  id: number;
  name: string;
  email: string;
}

export interface OfficialResponse {
  id: number;
  petition_id: number;
  official_id: number;
  official_name?: string;
  response: string;
  response_text?: string;
  action_taken?: string;
  created_at: string;
}

export interface PetitionResponse {
  id: number;
  title: string;
  description: string;
  category: PetitionCategory;
  location: string;
  status: PetitionStatus;
  signature_goal: number;
  signature_count: number;
  creator_id?: number;
  user?: PetitionUser;
  created_at: string;
  updated_at: string;
  photos?: string[];
  evidence_images?: string[];
  official_responses?: OfficialResponse[];
}

export interface PetitionListResponse {
  petitions: PetitionResponse[];
  total: number;
  page: number;
  per_page: number;
}

export type SignedPetitionItem = PetitionResponse & { signed_at?: string };

export interface PetitionDetailResponse extends PetitionResponse {
  has_signed: boolean;
  poll?: any;
  evidence_photos?: string[];
  image_url?: string;
}

export interface PetitionCreate {
  title: string;
  description: string;
  category: PetitionCategory;
  location: string;
  signature_goal?: number;
  photos?: string[];
}

export interface PetitionUpdate {
  title?: string;
  description?: string;
  category?: PetitionCategory;
  location?: string;
  signature_goal?: number;
  status?: PetitionStatus;
  photos?: string[];
}

export interface PetitionStatusUpdate {
  status: PetitionStatus;
}

export interface SignatureResponse {
  signature_count: number;
  has_signed: boolean;
}

export interface PetitionDeleteResponse {
  message: string;
}

export interface MyPetitionsResponse {
  petitions: PetitionResponse[];
  total: number;
  active_count: number;
  closed_count: number;
}

export interface SignedPetitionsResponse {
  petitions: (PetitionResponse & { signed_at: string })[];
  total: number;
}

export interface DashboardStats {
  total_petitions: number;
  active: number;
  under_review: number;
  in_progress: number;
  resolved: number;
  closed: number;
  total_signatures: number;
  department: string;
  jurisdiction: string;
}

export interface OfficialResponseCreate {
  response_text: string;
  action_taken?: string;
}

export interface OfficialDirectoryItem {
  id: number;
  name: string;
  department: string;
  department_id: string;
  location: string;
  profile_picture_url?: string;
}

export interface OfficialUser {
  id: number;
  name: string;
  email: string;
  location: string | null;
  organization: string | null;
  department: string | null;
  designation: string | null;
  jurisdiction: string | null;
  phone?: string | null;
  verification_status: string;
  document_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_id: number;
  actor_name: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class PetitionService {
  private baseUrl = `${environment.apiUrl}/api/petitions`;
  private officialUrl = `${environment.apiUrl}/api/official`;

  constructor(private http: HttpClient) {}

  createPetition(payload: PetitionCreate): Observable<PetitionResponse> {
    return this.http.post<PetitionResponse>(this.baseUrl, payload);
  }

  getPetitions(params?: {
    location?: string;
    category?: PetitionCategory;
    petition_status?: PetitionStatus;
    page?: number;
    per_page?: number;
  }): Observable<PetitionListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.location) httpParams = httpParams.set('location', params.location);
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.petition_status) httpParams = httpParams.set('petition_status', params.petition_status);
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    }
    return this.http.get<PetitionListResponse>(this.baseUrl, { params: httpParams });
  }

  getMyPetitions(): Observable<MyPetitionsResponse> {
    return this.http.get<MyPetitionsResponse>(`${this.baseUrl}/mine`);
  }

  getSignedPetitions(): Observable<SignedPetitionsResponse> {
    return this.http.get<SignedPetitionsResponse>(`${this.baseUrl}/signed`);
  }

  getPetition(petitionId: number): Observable<PetitionDetailResponse> {
    return this.http.get<PetitionDetailResponse>(`${this.baseUrl}/${petitionId}`);
  }

  updatePetition(petitionId: number, payload: PetitionUpdate): Observable<PetitionResponse> {
    return this.http.put<PetitionResponse>(`${this.baseUrl}/${petitionId}`, payload);
  }

  updatePetitionStatus(petitionId: number, status: PetitionStatus): Observable<PetitionResponse> {
    return this.http.patch<PetitionResponse>(`${this.officialUrl}/petitions/${petitionId}/status`, { status });
  }

  deletePetition(petitionId: number): Observable<PetitionDeleteResponse> {
    return this.http.delete<PetitionDeleteResponse>(`${this.baseUrl}/${petitionId}`);
  }

  signPetition(petitionId: number): Observable<SignatureResponse> {
    return this.http.post<SignatureResponse>(`${this.baseUrl}/${petitionId}/sign`, {});
  }

  // ── Official portal ────────────────────────────────────────────────────────

  getOfficialDashboard(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.officialUrl}/dashboard`);
  }

  getOfficialPetitions(params?: {
    petition_status?: PetitionStatus;
    category?: PetitionCategory;
    page?: number;
    per_page?: number;
  }): Observable<PetitionListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.petition_status) httpParams = httpParams.set('petition_status', params.petition_status);
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    }
    return this.http.get<PetitionListResponse>(`${this.officialUrl}/petitions`, { params: httpParams });
  }

  addOfficialResponse(petitionId: number, response_text: string, action_taken?: string): Observable<OfficialResponse> {
    return this.http.post<OfficialResponse>(
      `${this.officialUrl}/petitions/${petitionId}/response`,
      { response_text, action_taken }
    );
  }

  getPendingOfficials(): Observable<OfficialUser[]> {
    return this.http.get<OfficialUser[]>(`${this.officialUrl}/verifications/pending`);
  }

  getAllOfficials(): Observable<OfficialUser[]> {
    return this.http.get<OfficialUser[]>(`${this.officialUrl}/verifications/all`);
  }

  reviewOfficial(userId: number, action: 'approve' | 'reject' | 'request_info', reason?: string): Observable<{ message: string; verification_status: string }> {
    return this.http.patch<{ message: string; verification_status: string }>(
      `${this.officialUrl}/verifications/${userId}`,
      { action, reason }
    );
  }

  getAuditLogs(page = 1, per_page = 50): Observable<{ logs: AuditLogEntry[]; total: number }> {
    return this.http.get<{ logs: AuditLogEntry[]; total: number }>(
      `${this.officialUrl}/audit-logs`,
      { params: new HttpParams().set('page', page).set('per_page', per_page) }
    );
  }

  getOfficialsDirectory(): Observable<OfficialDirectoryItem[]> {
    return this.http.get<OfficialDirectoryItem[]>(`${this.baseUrl}/officials/directory`);
  }

  sendReportEmail(petitionId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${petitionId}/send-report-email`, {});
  }
}
