import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Itinerary,
  CreateItineraryRequest,
  UpdateItineraryStopsRequest,
  AddItineraryStopRequest,
  PageRequest,
} from '@shared/models';
import { CrudResource } from './crud-resource';

export interface ItineraryPageRequest extends PageRequest {
  lineId?: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class ItineraryService extends CrudResource<Itinerary, CreateItineraryRequest, CreateItineraryRequest, ItineraryPageRequest> {
  protected readonly baseUrl = '/api/itineraries';
  protected readonly http = inject(HttpClient);

  protected override extraListParams(request: ItineraryPageRequest): Record<string, string | undefined> {
    return { lineId: request.lineId };
  }

  getAll(lineId?: string): Observable<Itinerary[]> {
    return this.getAllListed({ lineId });
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
