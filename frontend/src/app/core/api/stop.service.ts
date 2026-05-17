import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stop, CreateStopRequest, PageRequest, PageResponse } from '@shared/models';
import { pageRequestToHttpParams } from '@shared/utils/page-request.utils';

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
    return this.http.get<Stop[]>(`${this.baseUrl}/all`, { params });
  }

  getAllPaginated(request: StopPageRequest = {}): Observable<PageResponse<Stop>> {
    const params = pageRequestToHttpParams(
      { ...request, page: request.page ?? 0 },
      { lineId: request.lineId },
    );
    return this.http.get<PageResponse<Stop>>(this.baseUrl, { params });
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
