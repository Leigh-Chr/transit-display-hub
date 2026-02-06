import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Schedule, CreateScheduleRequest } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  constructor(private http: HttpClient) {}

  getForStop(stopId: string): Observable<Schedule[]> {
    return this.http.get<Schedule[]>(`/api/stops/${stopId}/schedules`);
  }

  create(stopId: string, request: CreateScheduleRequest): Observable<Schedule> {
    return this.http.post<Schedule>(`/api/stops/${stopId}/schedules`, request);
  }

  update(id: string, request: CreateScheduleRequest): Observable<Schedule> {
    return this.http.put<Schedule>(`/api/schedules/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/schedules/${id}`);
  }
}
