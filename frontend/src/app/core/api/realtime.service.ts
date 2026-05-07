import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RealtimeAlert, VehiclePosition } from '@shared/models';

/**
 * Read-only access to the in-memory GTFS-Realtime caches behind
 * /api/admin/realtime/*. Each call returns the snapshot the
 * scheduler last fetched; "refresh" forces an immediate poll.
 *
 * Both endpoints return an empty list (with 400) when the matching
 * URL is not configured — the admin UI treats that as "feed disabled"
 * rather than "feed empty".
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly http = inject(HttpClient);

  getAlerts(): Observable<RealtimeAlert[]> {
    return this.http.get<RealtimeAlert[]>('/api/admin/realtime/alerts');
  }

  refreshAlerts(): Observable<RealtimeAlert[]> {
    return this.http.post<RealtimeAlert[]>('/api/admin/realtime/alerts/refresh', {});
  }

  getVehicles(): Observable<VehiclePosition[]> {
    return this.http.get<VehiclePosition[]>('/api/admin/realtime/vehicles');
  }

  refreshVehicles(): Observable<VehiclePosition[]> {
    return this.http.post<VehiclePosition[]>('/api/admin/realtime/vehicles/refresh', {});
  }
}
