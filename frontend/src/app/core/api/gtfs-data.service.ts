import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BookingRule, FareAttribute, ImportAudit, Pathway, Shape, Translation } from '@shared/models';

/**
 * Read-only access to the GTFS extension tables that the importer
 * persists but the existing admin CRUD doesn't surface — fares,
 * booking rules (demand-responsive transit), translations.
 *
 * Each endpoint returns the latest imported snapshot; admins refresh
 * by re-running the GTFS import.
 */
@Injectable({ providedIn: 'root' })
export class GtfsDataService {
  private readonly http = inject(HttpClient);

  getFares(): Observable<FareAttribute[]> {
    return this.http.get<FareAttribute[]>('/api/admin/fares');
  }

  getBookingRules(): Observable<BookingRule[]> {
    return this.http.get<BookingRule[]>('/api/admin/booking-rules');
  }

  /** Translation browse requires a target language; an optional table
   *  filter narrows the result to e.g. "stops" or "routes". */
  getTranslations(language: string, tableName?: string): Observable<Translation[]> {
    let params = new HttpParams().set('lang', language);
    if (tableName) {
      params = params.set('table', tableName);
    }
    return this.http.get<Translation[]>('/api/admin/translations', { params });
  }

  /** Import history, capped server-side to 200 rows. Sorted newest first. */
  getImportAudit(limit = 50): Observable<ImportAudit[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<ImportAudit[]>('/api/admin/import-audit', { params });
  }

  /** Indoor topology around a stop — escalators, lifts, exits, etc.
   *  Empty list when the feed has no pathways.txt or the stop has no
   *  inbound/outbound segments. */
  getPathwaysForStop(stopId: string): Observable<Pathway[]> {
    return this.http.get<Pathway[]>(`/api/stops/${stopId}/pathways`);
  }

  /** Geographic polyline of an itinerary's shape, ordered along the
   *  trip's natural direction. Returns 404 when the itinerary has
   *  no shape attached (feed shipped no shape_id). */
  getShapeForItinerary(itineraryId: string): Observable<Shape> {
    return this.http.get<Shape>(`/api/itineraries/${itineraryId}/shape`);
  }
}
