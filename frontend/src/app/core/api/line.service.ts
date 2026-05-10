import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Line, CreateLineRequest, PageRequest, PageResponse } from '@shared/models';
import { pageRequestToHttpParams } from '@shared/utils/page-request.utils';

@Injectable({
  providedIn: 'root'
})
export class LineService {
  private readonly baseUrl = '/api/lines';
  private readonly http = inject(HttpClient);

  getAll(): Observable<Line[]> {
    return this.http.get<Line[]>(this.baseUrl);
  }

  getAllPaginated(request: PageRequest = {}): Observable<PageResponse<Line>> {
    const params = pageRequestToHttpParams({ ...request, page: request.page ?? 0 });
    return this.http.get<PageResponse<Line>>(this.baseUrl, { params });
  }

  create(request: CreateLineRequest): Observable<Line> {
    return this.http.post<Line>(this.baseUrl, request);
  }

  update(id: string, request: CreateLineRequest): Observable<Line> {
    return this.http.put<Line>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- known typescript-eslint issue with expression-level generics
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
