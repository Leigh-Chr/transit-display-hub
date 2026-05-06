import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DisplayState, HubDisplayState } from '@shared/models';

export interface AuthenticatedDisplayState {
  deviceId: string | null;
  state: DisplayState;
}

@Injectable({
  providedIn: 'root'
})
export class DisplayService {
  private readonly http = inject(HttpClient);

  getState(stopId: string): Observable<DisplayState> {
    return this.http.get<DisplayState>(`/api/display/${stopId}`);
  }

  getStateByToken(token: string): Observable<AuthenticatedDisplayState> {
    const headers = new HttpHeaders().set('X-Device-Token', token);
    return this.http
      .get<DisplayState>('/api/display', { headers, observe: 'response' })
      .pipe(
        map(response => {
          if (response.body === null) {
            throw new Error('Empty display state body');
          }
          return {
            deviceId: response.headers.get('X-Device-Id'),
            state: response.body,
          };
        })
      );
  }

  getHubState(stopIds: string[], name: string): Observable<HubDisplayState> {
    const params = new HttpParams()
      .set('stopIds', stopIds.join(','))
      .set('name', name);
    return this.http.get<HubDisplayState>('/api/display/hub', { params });
  }
}
