import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { FeedInfo } from '@shared/models';

/**
 * Reads the singleton {@link FeedInfo} record describing the GTFS feed
 * currently loaded into the database. Returns {@code null} when no feed
 * has been imported yet (the synthetic seed path leaves the table empty).
 */
@Injectable({ providedIn: 'root' })
export class FeedInfoService {
  private readonly http = inject(HttpClient);

  getFeedInfo(): Observable<FeedInfo | null> {
    return this.http
      .get<FeedInfo>('/api/admin/feed-info', { observe: 'response' })
      .pipe(
        // The endpoint returns 204 No Content when the table is empty.
        // Map that to a typed `null` so the dashboard can render "no feed
        // imported" without a special HTTP code branch in every consumer.
        map((response: HttpResponse<FeedInfo>) =>
          response.status === 204 ? null : response.body,
        ),
      );
  }
}
