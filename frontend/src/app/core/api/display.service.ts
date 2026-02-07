import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DisplayState, HubDisplayState } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class DisplayService {
  private readonly http = inject(HttpClient);

  getState(stopId: string): Observable<DisplayState> {
    return this.http.get<DisplayState>(`/api/display/${stopId}`);
  }

  getStateByToken(token: string): Observable<DisplayState> {
    const headers = new HttpHeaders().set('X-Device-Token', token);
    return this.http.get<DisplayState>('/api/display', { headers });
  }

  getHubState(stopIds: string[], name: string): Observable<HubDisplayState> {
    const params = new HttpParams()
      .set('stopIds', stopIds.join(','))
      .set('name', name);
    return this.http.get<HubDisplayState>('/api/display/hub', { params });
  }
}
