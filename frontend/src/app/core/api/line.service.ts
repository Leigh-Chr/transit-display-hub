import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Line, CreateLineRequest } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class LineService {
  private readonly baseUrl = '/api/lines';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Line[]> {
    return this.http.get<Line[]>(this.baseUrl);
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
