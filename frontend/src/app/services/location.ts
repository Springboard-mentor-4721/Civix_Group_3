import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private nominatimUrl = 'https://nominatim.openstreetmap.org/search';

  constructor(private http: HttpClient) {}

  searchLocations(query: string): Observable<string[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('format', 'json')
      .set('limit', '5')
      .set('addressdetails', '1');

    return this.http.get<NominatimResult[]>(this.nominatimUrl, { params }).pipe(
      map((results) => results.map((r) => r.display_name)),
      catchError(() => of([]))
    );
  }

  getSuggestions(query: string): Observable<string[]> {
    return this.searchLocations(query);
  }

  getCurrentLocationText(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const params = new HttpParams()
            .set('lat', latitude.toString())
            .set('lon', longitude.toString())
            .set('format', 'json');

          this.http
            .get<{ display_name: string }>('https://nominatim.openstreetmap.org/reverse', { params })
            .pipe(catchError(() => of({ display_name: latitude.toFixed(4) + ', ' + longitude.toFixed(4) })))
            .subscribe({
              next: (result) => resolve(result.display_name),
              error: (err) => reject(err)
            });
        },
        (error) => {
          reject(new Error(error.message || 'Could not detect location.'));
        }
      );
    });
  }
}
