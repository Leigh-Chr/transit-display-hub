import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Itinerary,
  CreateItineraryRequest,
  UpdateItineraryStopsRequest,
  AddItineraryStopRequest,
  PageRequest,
  PageResponse
} from '@shared/models';

export interface ItineraryPageRequest extends PageRequest {
  lineId?: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class ItineraryService {
  private readonly baseUrl = '/api/itineraries';
  private readonly http = inject(HttpClient);

  getAll(lineId?: string): Observable<Itinerary[]> {
    let params = new HttpParams();
    if (lineId) {
      params = params.set('lineId', lineId);
    }
    return this.http.get<Itinerary[]>(this.baseUrl, { params });
  }

  getAllPaginated(request: ItineraryPageRequest = {}): Observable<PageResponse<Itinerary>> {
    let params = new HttpParams().set('page', String(request.page ?? 0));
    if (request.size) {params = params.set('size', String(request.size));}
    if (request.sortBy) {params = params.set('sortBy', request.sortBy);}
    if (request.sortDir) {params = params.set('sortDir', request.sortDir);}
    if (request.search) {params = params.set('search', request.search);}
    if (request.lineId) {params = params.set('lineId', request.lineId);}
    return this.http.get<PageResponse<Itinerary>>(this.baseUrl, { params });
  }

  get(id: string): Observable<Itinerary> {
    return this.http.get<Itinerary>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateItineraryRequest): Observable<Itinerary> {
    return this.http.post<Itinerary>(this.baseUrl, request);
  }

  update(id: string, request: CreateItineraryRequest): Observable<Itinerary> {
    return this.http.put<Itinerary>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- known typescript-eslint issue with expression-level generics
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  updateStops(id: string, request: UpdateItineraryStopsRequest): Observable<Itinerary> {
    return this.http.put<Itinerary>(`${this.baseUrl}/${id}/stops`, request);
  }

  addStop(id: string, request: AddItineraryStopRequest): Observable<Itinerary> {
    return this.http.post<Itinerary>(`${this.baseUrl}/${id}/stops`, request);
  }

  removeStop(itineraryId: string, stopId: string): Observable<Itinerary> {
    return this.http.delete<Itinerary>(`${this.baseUrl}/${itineraryId}/stops/${stopId}`);
  }
}
