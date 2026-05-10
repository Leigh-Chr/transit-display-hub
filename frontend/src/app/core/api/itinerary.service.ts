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
import { pageRequestToHttpParams } from '@shared/utils/page-request.utils';

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
    const params = pageRequestToHttpParams(
      { ...request, page: request.page ?? 0 },
      { lineId: request.lineId },
    );
    return this.http.get<PageResponse<Itinerary>>(this.baseUrl, { params });
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
