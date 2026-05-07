import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DataOverview } from '@shared/models';

/**
 * Single-call snapshot of every persisted GTFS entity count plus the
 * realtime cache sizes. Renders behind the admin dashboard's data
 * overview card.
 */
@Injectable({ providedIn: 'root' })
export class DataOverviewService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<DataOverview> {
    return this.http.get<DataOverview>('/api/admin/data-overview');
  }
}
