import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { BookingRule, FlexLocation, NetworkMap, NetworkMapAlerts, StationPathwayGraph } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class NetworkMapDataService {
  private readonly http = inject(HttpClient);

  getNetworkMap(): Observable<NetworkMap> {
    return this.http.get<NetworkMap>('/api/network-map');
  }

  getAlerts(): Observable<NetworkMapAlerts> {
    return this.http.get<NetworkMapAlerts>('/api/network-map/alerts');
  }

  /** Fetch the GTFS-flex zone polygon attached to a stop, or null when
   *  the stop has no flex location bound to it. The 404 is normal —
   *  most stops on a given network won't have a zone, even those with
   *  on-demand pickups, so the popup gates the call on
   *  {@code hasOnDemand} but handles "no zone" silently. */
  getStopTadZone(stopId: string): Observable<FlexLocation | null> {
    return this.http
      .get<FlexLocation>(`/api/network-map/stops/${stopId}/tad-zone`)
      .pipe(catchError(() => of(null)));
  }

  /** Fetch the GTFS booking_rules referenced by this stop's schedules
   *  and flex_stop_times. Used by the popup to render booking
   *  instructions on an on-demand pickup. Empty array when the stop
   *  has no on-demand service. */
  getStopBookingRules(stopId: string): Observable<BookingRule[]> {
    return this.http
      .get<BookingRule[]>(`/api/network-map/stops/${stopId}/booking-rules`)
      .pipe(catchError(() => of([] as BookingRule[])));
  }

  /** Fetch the indoor pathway graph rooted at this stop's parent
   *  station. Used by the popup to render "ascenseur jusqu'au quai 2".
   *  Returns null when the stop is unknown; an empty graph (no
   *  pathways) is returned for stations without indoor topology. */
  getStopPathwayGraph(stopId: string): Observable<StationPathwayGraph | null> {
    return this.http
      .get<StationPathwayGraph>(`/api/network-map/stops/${stopId}/pathways`)
      .pipe(catchError(() => of(null)));
  }
}
