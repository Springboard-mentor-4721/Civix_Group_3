import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';


export type PollStatus =
  'draft' |
  'scheduled' |
  'active' |
  'closed';


export interface PollOption {

  id: number;

  poll_id: number;

  option_text: string;

  display_order: number;
}


export interface PollOptionCreate {

  option_text: string;

  display_order?: number;
}


export interface PollResponse {

  id: number;

  title: string;

  question: string;

  description: string | null;

  category: string;

  location: string;

  petition_id?: number | null;

  petition_title?: string | null;

  start_at: string;

  end_at: string;

  status: PollStatus;

  created_by: number;

  creator_name: string | null;

  created_at: string;

  updated_at: string;

  options: PollOption[];

  total_votes: number;

  has_voted: boolean;

  voted_option_id: number | null;
}


export interface PollListResponse {

  polls: PollResponse[];

  total: number;

  page: number;

  per_page: number;
}


export interface PollOptionResult {

  id: number;

  text: string;

  votes: number;

  percentage: number;
}


export interface VotingActivityPoint {

  date: string;

  votes: number;
}


export interface PollResultsResponse {

  poll_id: number;

  title: string;

  question: string;

  description: string | null;

  category: string;

  location: string;

  petition_id?: number | null;

  petition_title?: string | null;

  status: PollStatus;

  start_at: string;

  end_at: string;

  total_votes: number;

  options: PollOptionResult[];

  voting_activity: VotingActivityPoint[];
}


export interface PollCreatePayload {

  title: string;

  question: string;

  description?: string;

  category: string;

  location: string;

  petition_id: number;

  start_at: string;

  end_at: string;

  options: PollOptionCreate[];
}


export interface PollUpdatePayload {

  title?: string;

  question?: string;

  description?: string;

  category?: string;

  location?: string;

  petition_id?: number | null;

  start_at?: string;

  end_at?: string;

  options?: PollOptionCreate[];
}


@Injectable({
  providedIn: 'root'
})
export class PollsService {

  private readonly baseUrl =
    `${environment.apiUrl}/api/polls`;


  constructor(
    private http: HttpClient
  ) {}


  // =========================
  // GET ALL POLLS
  // =========================

  getPolls(filters?: {

    category?: string;

    location?: string;

    status?: string;

    search?: string;

    page?: number;

    per_page?: number;

  }): Observable<PollListResponse> {

    let params = new HttpParams();


    if (
      filters?.category &&
      filters.category !== 'all'
    ) {
      params = params.set(
        'category',
        filters.category
      );
    }


    if (filters?.location) {

      params = params.set(
        'location',
        filters.location
      );

    }


    if (
      filters?.status &&
      filters.status !== 'all'
    ) {
      params = params.set(
        'status',
        filters.status
      );
    }


    if (filters?.search) {

      params = params.set(
        'search',
        filters.search
      );

    }


    if (filters?.page) {

      params = params.set(
        'page',
        filters.page.toString()
      );

    }


    if (filters?.per_page) {

      params = params.set(
        'per_page',
        filters.per_page.toString()
      );

    }


    return this.http.get<PollListResponse>(
      this.baseUrl,
      { params }
    );
  }


  // =========================
  // MY POLLS
  // =========================

  getMyPolls(
    page: number = 1,
    per_page: number = 20
  ): Observable<PollListResponse> {

    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', per_page.toString());


    return this.http.get<PollListResponse>(
      `${this.baseUrl}/mine`,
      { params }
    );
  }


  // =========================
  // POLL DETAIL
  // =========================

  getPollDetail(
    poll_id: number
  ): Observable<PollResponse> {

    return this.http.get<PollResponse>(
      `${this.baseUrl}/${poll_id}`
    );
  }


  // =========================
  // VOTE
  // =========================

  vote(
    poll_id: number,
    option_id: number
  ): Observable<PollResultsResponse> {

    return this.http.post<PollResultsResponse>(
      `${this.baseUrl}/${poll_id}/vote`,
      {
        option_id
      }
    );
  }


  // =========================
  // POLL RESULTS
  // =========================

  getPollResults(
    poll_id: number
  ): Observable<PollResultsResponse> {

    return this.http.get<PollResultsResponse>(
      `${this.baseUrl}/${poll_id}/results`
    );
  }


  // =========================
  // CREATE POLL
  // =========================

  createPoll(
    data: PollCreatePayload
  ): Observable<PollResponse> {

    return this.http.post<PollResponse>(
      this.baseUrl,
      data
    );
  }


  // =========================
  // UPDATE POLL
  // =========================

  updatePoll(
    poll_id: number,
    data: PollUpdatePayload
  ): Observable<PollResponse> {

    return this.http.put<PollResponse>(
      `${this.baseUrl}/${poll_id}`,
      data
    );
  }


  // =========================
  // UPDATE STATUS
  // =========================

  patchPollStatus(
    poll_id: number,
    status: PollStatus
  ): Observable<PollResponse> {

    return this.http.patch<PollResponse>(
      `${this.baseUrl}/${poll_id}/status`,
      {
        status
      }
    );
  }


  // =========================
  // DELETE POLL
  // =========================

  deletePoll(
    poll_id: number
  ): Observable<any> {

    return this.http.delete<any>(
      `${this.baseUrl}/${poll_id}`
    );
  }
}
