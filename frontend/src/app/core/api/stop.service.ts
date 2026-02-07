import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stop, CreateStopRequest, PageRequest, PageResponse } from '@shared/models';

export interface StopPageRequest extends PageRequest {
  lineId?: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class StopService {
  private readonly baseUrl = '/api/stops';
  private readonly http = inject(HttpClient);

  getAll(lineId?: string): Observable<Stop[]> {
    let params = new HttpParams();
    if (lineId) {
      params = params.set('lineId', lineId);
    }
    return this.http.get<Stop[]>(this.baseUrl, { params });
  }

  getAllPaginated(request: StopPageRequest = {}): Observable<PageResponse<Stop>> {
    let params = new HttpParams().set('page', String(request.page ?? 0));
    if (request.size) {params = params.set('size', String(request.size));}
    if (request.sortBy) {params = params.set('sortBy', request.sortBy);}
    if (request.sortDir) {params = params.set('sortDir', request.sortDir);}
    if (request.search) {params = params.set('search', request.search);}
    if (request.lineId) {params = params.set('lineId', request.lineId);}
    return this.http.get<PageResponse<Stop>>(this.baseUrl, { params });
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
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- known typescript-eslint issue with expression-level generics
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
