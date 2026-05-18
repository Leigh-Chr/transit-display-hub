import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

import { FlexStopTime } from '@shared/models';

/**
 * Reads GTFS-flex stop_times — public lookup of the windows running
 * today at a given flex location, consumed by the network-map stop
 * popup.
 */
@Injectable({ providedIn: 'root' })
export class FlexStopTimeService {
  private readonly http = inject(HttpClient);

  /** Public: list flex windows running on the given date for a
   *  GeoJSON location id. Defaults to today server-side when the
   *  date is omitted. Empty array when no service runs that day. */
  getWindowsForLocation(externalId: string, date?: string): Observable<FlexStopTime[]> {
    const url = `/api/network-map/locations/${encodeURIComponent(externalId)}/flex-windows${
      date ? `?date=${date}` : ''
    }`;
    return this.http.get<FlexStopTime[]>(url).pipe(catchError(() => of([] as FlexStopTime[])));
  }
}
