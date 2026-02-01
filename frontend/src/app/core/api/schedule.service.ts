import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TimedEntry, CreateTimedEntryRequest } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  constructor(private http: HttpClient) {}

  getForStop(stopId: string): Observable<TimedEntry[]> {
    return this.http.get<TimedEntry[]>(`/api/stops/${stopId}/schedules`);
  }

  create(stopId: string, request: CreateTimedEntryRequest): Observable<TimedEntry> {
    return this.http.post<TimedEntry>(`/api/stops/${stopId}/schedules`, request);
  }

  update(id: string, request: CreateTimedEntryRequest): Observable<TimedEntry> {
    return this.http.put<TimedEntry>(`/api/schedules/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/schedules/${id}`);
  }
}
