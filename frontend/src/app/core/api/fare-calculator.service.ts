import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

import { FareCalculationResult } from '@shared/models';

/**
 * Public fare calculator. Computes the GTFS fares applicable for a
 * trip between two stops by combining V1 ({@code fare_attributes} +
 * {@code fare_rules}) and V2 ({@code fare_leg_rules} + {@code areas}).
 */
@Injectable({ providedIn: 'root' })
export class FareCalculatorService {
  private readonly http = inject(HttpClient);

  calculate(fromStopId: string, toStopId: string): Observable<FareCalculationResult | null> {
    return this.http
      .get<FareCalculationResult>(
        `/api/fares/calculate?from=${fromStopId}&to=${toStopId}`)
      .pipe(catchError(() => of(null)));
  }
}
