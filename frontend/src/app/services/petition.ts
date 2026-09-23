import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type PetitionCategory =
  | 'Environment'
  | 'Infrastructure'
  | 'Education'
  | 'Public Safety'
  | 'Transportation'
  | 'Healthcare'
  | 'Housing';

export type PetitionStatus = 'active' | 'under_review' | 'in_progress' | 'resolved' | 'closed';

export interface PetitionCreate {
  title: string;
  description: string;
  category: PetitionCategory;
  location: string;
  signature_goal: number;
  photos?: string[];
}

export interface PetitionUpdate {
  title?: string;
  description?: string;
  category?: PetitionCategory;
  location?: string;
  signature_goal?: number;
}

export interface PetitionPhotoItem {
  id: number;
  url: string;
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
  creator_id: number;
  creator_name?: string;
  creator_profile_picture_url?: string | null;
  created_at: string;
  updated_at: string;
  photos?: PetitionPhotoItem[];
}

export interface LinkedPollInfo {
  id: number;
  title: string;
  question: string;
  category: string;
  location: string;
  status: string;
  total_votes: number;
  has_voted: boolean;
  voted_option_id?: number | null;
  created_at: string;
}

export interface PetitionDetailResponse extends PetitionResponse {
  has_signed: boolean;
  poll?: LinkedPollInfo | null;
}

export interface PetitionListResponse {
  petitions: PetitionResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface MyPetitionsResponse {
  petitions: PetitionResponse[];
  total: number;
  active_count: number;
  closed_count: number;
}

export interface SignedPetitionItem extends PetitionResponse {
  signed_at?: string;
}

export interface SignedPetitionsResponse {
  petitions: SignedPetitionItem[];
  total: number;
}

export interface SignatureResponse {
  signature_count: number;
  has_signed: boolean;
}

export interface PetitionDeleteResponse {
  message: string;
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

export interface OfficialResponse {
  id: number;
  petition_id: number;
  official_id: number;
  response_text: string;
  action_taken: string | null;
  created_at: string;
}

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PetitionService {
  private readonly baseUrl = `${environment.apiUrl}/api/petitions`;

  constructor(private http: HttpClient) {}

  /**
   * POST /api/petitions - Create a new petition
   */
  createPetition(payload: PetitionCreate): Observable<PetitionResponse> {
    return this.http.post<PetitionResponse>(this.baseUrl, payload);
  }

  /**
   * GET /api/petitions - List petitions with optional query filters and pagination
   */
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

  /**
   * GET /api/petitions/mine - Get petitions created by the current user
   */
  getMyPetitions(): Observable<MyPetitionsResponse> {
    return this.http.get<MyPetitionsResponse>(`${this.baseUrl}/mine`);
  }

  /**
   * GET /api/petitions/signed - Get petitions signed by the current user
   */
  getSignedPetitions(): Observable<SignedPetitionsResponse> {
    return this.http.get<SignedPetitionsResponse>(`${this.baseUrl}/signed`);
  }

  /**
   * GET /api/petitions/{petition_id} - Get single petition detail with has_signed status
   */
  getPetition(petitionId: number): Observable<PetitionDetailResponse> {
    return this.http.get<PetitionDetailResponse>(`${this.baseUrl}/${petitionId}`);
  }

  /**
   * PUT /api/petitions/{petition_id} - Update petition (creator only)
   */
  updatePetition(petitionId: number, payload: PetitionUpdate): Observable<PetitionResponse> {
    return this.http.put<PetitionResponse>(`${this.baseUrl}/${petitionId}`, payload);
  }

  /**
   * PATCH /api/petitions/{petition_id}/status - Update petition status (officials only)
   */
  updatePetitionStatus(petitionId: number, status: PetitionStatus): Observable<PetitionResponse> {
    return this.http.patch<PetitionResponse>(`${this.baseUrl}/${petitionId}/status`, { status });
  }

  /**
   * DELETE /api/petitions/{petition_id} - Delete petition (creator only)
   */
  deletePetition(petitionId: number): Observable<PetitionDeleteResponse> {
    return this.http.delete<PetitionDeleteResponse>(`${this.baseUrl}/${petitionId}`);
  }

  /**
   * POST /api/petitions/{petition_id}/sign - Sign a petition
   */
  signPetition(petitionId: number): Observable<SignatureResponse> {
    return this.http.post<SignatureResponse>(`${this.baseUrl}/${petitionId}/sign`, {});
  }

  /**
   * GET /api/petitions/official/dashboard - Official dashboard stats
   */
  getOfficialDashboard(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.baseUrl}/official/dashboard`);
  }

  /**
   * GET /api/petitions/official/list - Petitions for official's department
   */
  getOfficialPetitions(params?: {
    petition_status?: PetitionStatus;
    page?: number;
    per_page?: number;
  }): Observable<PetitionListResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.petition_status) httpParams = httpParams.set('petition_status', params.petition_status);
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    }
    return this.http.get<PetitionListResponse>(`${this.baseUrl}/official/list`, { params: httpParams });
  }

  /**
   * POST /api/petitions/{petition_id}/respond - Add official response
   */
  addOfficialResponse(petitionId: number, response_text: string, action_taken?: string): Observable<OfficialResponse> {
    return this.http.post<OfficialResponse>(`${this.baseUrl}/${petitionId}/respond`, { response_text, action_taken });
  }
}
