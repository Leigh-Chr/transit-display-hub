import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stop, CreateStopRequest } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class StopService {
  private readonly baseUrl = '/api/stops';

  constructor(private http: HttpClient) {}

  getAll(lineId?: string): Observable<Stop[]> {
    let params = new HttpParams();
    if (lineId) {
      params = params.set('lineId', lineId);
    }
    return this.http.get<Stop[]>(this.baseUrl, { params });
  }

  get(id: string): Observable<Stop> {
    return this.http.get<Stop>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateStopRequest): Observable<Stop> {
    return this.http.post<Stop>(this.baseUrl, request);
  }

  update(id: string, request: CreateStopRequest): Observable<Stop> {
    return this.http.put<Stop>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
