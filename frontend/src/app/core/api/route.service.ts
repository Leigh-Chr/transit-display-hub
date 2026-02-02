import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Route, CreateRouteRequest, PageRequest, PageResponse } from '@shared/models';

export interface RoutePageRequest extends PageRequest {
  lineId?: string;
}

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

  getAllPaginated(request: RoutePageRequest = {}): Observable<PageResponse<Route>> {
    let params = new HttpParams().set('page', String(request.page ?? 0));
    if (request.size) params = params.set('size', String(request.size));
    if (request.sortBy) params = params.set('sortBy', request.sortBy);
    if (request.sortDir) params = params.set('sortDir', request.sortDir);
    if (request.search) params = params.set('search', request.search);
    if (request.lineId) params = params.set('lineId', request.lineId);
    return this.http.get<PageResponse<Route>>(this.baseUrl, { params });
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
