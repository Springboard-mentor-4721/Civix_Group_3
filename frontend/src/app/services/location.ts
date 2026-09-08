import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  constructor(private http: HttpClient) {}

  async getCurrentLocationText(): Promise<string> {
    // Primary: GPS (accurate, actual location)
    if (typeof window !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 10000, maximumAge: 0
          })
        );
        const { latitude: lat, longitude: lon } = pos.coords;
        const res: any = await firstValueFrom(
          this.http.get(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`)
            .pipe(catchError(() => of(null)))
        );
        if (res?.address) {
          const a = res.address;
          const city = a.city || a.town || a.village || a.municipality || a.suburb || a.county || '';
          const state = a.state || a.state_district || '';
          if (city && state) return `${city}, ${state}`;
          if (city) return city;
          if (state) return state;
        }
      } catch (_) {}
    }

    // Fallback: IP-based (no permission, less accurate)
    const ipApis = [
      () => this.tryIpApiCo(),
      () => this.tryFreeIpApi(),
      () => this.tryIpWho(),
    ];
    for (const fn of ipApis) {
      try {
        const result = await fn();
        if (result) return result;
      } catch (_) {}
    }

    throw new Error('Could not detect location. Please enter it manually.');
  }

  private async tryIpApiCo(): Promise<string | null> {
    const res: any = await firstValueFrom(
      this.http.get('https://ipapi.co/json/').pipe(catchError(() => of(null)))
    );
    if (res?.city && res?.region) return `${res.city}, ${res.region}`;
    if (res?.city) return res.city;
    return null;
  }

  private async tryFreeIpApi(): Promise<string | null> {
    const res: any = await firstValueFrom(
      this.http.get('https://freeipapi.com/api/json').pipe(catchError(() => of(null)))
    );
    if (res?.cityName && res?.regionName) return `${res.cityName}, ${res.regionName}`;
    if (res?.cityName) return res.cityName;
    return null;
  }

  private async tryIpWho(): Promise<string | null> {
    const res: any = await firstValueFrom(
      this.http.get('https://ipwho.is/').pipe(catchError(() => of(null)))
    );
    if (res?.city && res?.region) return `${res.city}, ${res.region}`;
    if (res?.city) return res.city;
    return null;
  }

  searchLocations(query: string): Observable<string[]> {
    if (!query || query.trim().length < 2) return of([]);

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query.trim())}&addressdetails=1&limit=6`;
    return this.http.get<any[]>(url).pipe(
      map(results => {
        if (!Array.isArray(results)) return [];
        return results
          .map(item => {
            const addr = item.address || {};
            const city = addr.city || addr.town || addr.village || addr.municipality || item.name || '';
            const state = addr.state || addr.state_district || '';
            const country = addr.country || '';
            if (city && state) return `${city}, ${state}`;
            if (city && country) return `${city}, ${country}`;
            return item.display_name?.split(',').slice(0, 2).join(', ') || '';
          })
          .filter((v, i, arr) => v && arr.indexOf(v) === i);
      }),
      catchError(() => of([]))
    );
  }
}
