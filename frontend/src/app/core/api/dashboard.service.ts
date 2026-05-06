import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BroadcastMessage, Device, Line } from '@shared/models';

export interface DashboardSummary {
  lineCount: number;
  stopCount: number;
  itineraryCount: number;
  topLines: Line[];
  activeMessages: BroadcastMessage[];
  recentMessages: BroadcastMessage[];
  devices: {
    total: number;
    online: number;
    offline: number;
    offlinePreview: Device[];
  };
}

/**
 * Single-call backend for the admin dashboard. Replaces five non-paginated
 * forkJoin GETs that each downloaded the entire domain table.
 */
@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/admin/dashboard');
  }
}
