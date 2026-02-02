import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Route, CreateRouteRequest } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private readonly baseUrl = '/api/routes';

  constructor(private http: HttpClient) {}

  getAll(lineId?: string): Observable<Route[]> {
    let params = new HttpParams();
    if (lineId) {
      params = params.set('lineId', lineId);
    }
    return this.http.get<Route[]>(this.baseUrl, { params });
  }

  get(id: string): Observable<Route> {
    return this.http.get<Route>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateRouteRequest): Observable<Route> {
    return this.http.post<Route>(this.baseUrl, request);
  }

  update(id: string, request: CreateRouteRequest): Observable<Route> {
    return this.http.put<Route>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
