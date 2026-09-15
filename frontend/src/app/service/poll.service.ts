import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Poll } from '../models/poll.model';

@Injectable({
  providedIn: 'root'
})
export class PollService {

  private apiUrl = 'http://localhost:5000/api/polls';

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getPolls(
    location?: string,
    status?: string
  ): Observable<Poll[]> {

    let params = new HttpParams();

    if (location) {
      params = params.set('location', location);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<Poll[]>(
      this.apiUrl,
      { params }
    );
  }

  getPoll(id: number): Observable<Poll> {
    return this.http.get<Poll>(
      `${this.apiUrl}/${id}`
    );
  }

  createPoll(data: any): Observable<Poll> {
    return this.http.post<Poll>(
      this.apiUrl,
      data,
      { headers: this.authHeaders() }
    );
  }

  updatePoll(id: number, data: any): Observable<Poll> {
    return this.http.put<Poll>(
      `${this.apiUrl}/${id}`,
      data,
      { headers: this.authHeaders() }
    );
  }

  deletePoll(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/${id}`,
      { headers: this.authHeaders() }
    );
  }

  vote(id: number, selectedOption: string): Observable<Poll> {
    return this.http.post<Poll>(
      `${this.apiUrl}/${id}/vote`,
      { selected_option: selectedOption },
      { headers: this.authHeaders() }
    );
  }

  changeVote(id: number, selectedOption: string): Observable<Poll> {
    return this.http.put<Poll>(
      `${this.apiUrl}/${id}/vote`,
      { selected_option: selectedOption },
      { headers: this.authHeaders() }
    );
  }

  withdrawVote(id: number): Observable<Poll> {
    return this.http.delete<Poll>(
      `${this.apiUrl}/${id}/vote`,
      { headers: this.authHeaders() }
    );
  }

  getMyPolls(): Observable<Poll[]> {
    return this.http.get<Poll[]>(
      `${this.apiUrl}/mine`,
      { headers: this.authHeaders() }
    );
  }

  getVotedPolls(): Observable<Poll[]> {
    return this.http.get<Poll[]>(
      `${this.apiUrl}/voted`,
      { headers: this.authHeaders() }
    );
  }
}
