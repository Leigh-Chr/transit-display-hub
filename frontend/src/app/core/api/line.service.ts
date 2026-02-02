import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Line, CreateLineRequest, PageRequest, PageResponse } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class LineService {
  private readonly baseUrl = '/api/lines';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Line[]> {
    return this.http.get<Line[]>(this.baseUrl);
  }

  getAllPaginated(request: PageRequest = {}): Observable<PageResponse<Line>> {
    let params = new HttpParams().set('page', String(request.page ?? 0));
    if (request.size) params = params.set('size', String(request.size));
    if (request.sortBy) params = params.set('sortBy', request.sortBy);
    if (request.sortDir) params = params.set('sortDir', request.sortDir);
    if (request.search) params = params.set('search', request.search);
    return this.http.get<PageResponse<Line>>(this.baseUrl, { params });
  }

  get(id: string): Observable<Line> {
    return this.http.get<Line>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateLineRequest): Observable<Line> {
    return this.http.post<Line>(this.baseUrl, request);
  }

  update(id: string, request: CreateLineRequest): Observable<Line> {
    return this.http.put<Line>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
