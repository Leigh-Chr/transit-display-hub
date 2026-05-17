import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BroadcastMessage, CreateMessageRequest, MessageSeverity, PageRequest, PageResponse } from '@shared/models';
import { pageRequestToHttpParams } from '@shared/utils/page-request.utils';

export interface MessagePageRequest extends PageRequest {
  active?: boolean | undefined;
  severity?: MessageSeverity | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private readonly baseUrl = '/api/messages';
  private readonly http = inject(HttpClient);

  getAll(activeOnly = false): Observable<BroadcastMessage[]> {
    let params = new HttpParams();
    if (activeOnly) {
      params = params.set('active', 'true');
    }
    return this.http.get<BroadcastMessage[]>(`${this.baseUrl}/all`, { params });
  }

  getAllPaginated(request: MessagePageRequest = {}): Observable<PageResponse<BroadcastMessage>> {
    const params = pageRequestToHttpParams(
      { ...request, page: request.page ?? 0 },
      {
        active: request.active ? 'true' : undefined,
        severity: request.severity,
      },
    );
    return this.http.get<PageResponse<BroadcastMessage>>(this.baseUrl, { params });
  }

  create(request: CreateMessageRequest): Observable<BroadcastMessage> {
    return this.http.post<BroadcastMessage>(this.baseUrl, request);
  }

  update(id: string, request: CreateMessageRequest): Observable<BroadcastMessage> {
    return this.http.put<BroadcastMessage>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- known typescript-eslint issue with expression-level generics
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
