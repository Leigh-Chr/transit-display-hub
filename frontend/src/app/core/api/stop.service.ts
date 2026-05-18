import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stop, CreateStopRequest, PageRequest } from '@shared/models';
import { CrudResource } from './crud-resource';

export interface StopPageRequest extends PageRequest {
  lineId?: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class StopService extends CrudResource<Stop, CreateStopRequest, CreateStopRequest, StopPageRequest> {
  protected readonly baseUrl = '/api/stops';
  protected readonly http = inject(HttpClient);

  protected override extraListParams(request: StopPageRequest): Record<string, string | undefined> {
    return { lineId: request.lineId };
  }

  getAll(lineId?: string): Observable<Stop[]> {
    return this.getAllListed({ lineId });
  }
}
