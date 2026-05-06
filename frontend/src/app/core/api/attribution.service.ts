import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Attribution } from '@shared/models';

/**
 * Reads the GTFS attributions credit block. Public endpoint — used by
 * both the authenticated admin dashboard and the anonymous network map
 * footer.
 */
@Injectable({ providedIn: 'root' })
export class AttributionService {
  private readonly http = inject(HttpClient);

  getAllAttributions(): Observable<Attribution[]> {
    return this.http.get<Attribution[]>('/api/attributions');
  }
}
