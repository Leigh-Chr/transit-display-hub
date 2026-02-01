import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BroadcastMessage, CreateMessageRequest } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private readonly baseUrl = '/api/messages';

  constructor(private http: HttpClient) {}

  getAll(activeOnly: boolean = false): Observable<BroadcastMessage[]> {
    let params = new HttpParams();
    if (activeOnly) {
      params = params.set('active', 'true');
    }
    return this.http.get<BroadcastMessage[]>(this.baseUrl, { params });
  }

  get(id: string): Observable<BroadcastMessage> {
    return this.http.get<BroadcastMessage>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateMessageRequest): Observable<BroadcastMessage> {
    return this.http.post<BroadcastMessage>(this.baseUrl, request);
  }

  update(id: string, request: CreateMessageRequest): Observable<BroadcastMessage> {
    return this.http.put<BroadcastMessage>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
