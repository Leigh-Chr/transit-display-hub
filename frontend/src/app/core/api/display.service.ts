import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DisplayState } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class DisplayService {
  constructor(private http: HttpClient) {}

  getState(stopId: string): Observable<DisplayState> {
    return this.http.get<DisplayState>(`/api/display/${stopId}`);
  }

  getStateByToken(token: string): Observable<DisplayState> {
    const headers = new HttpHeaders().set('X-Device-Token', token);
    return this.http.get<DisplayState>('/api/display', { headers });
  }
}
