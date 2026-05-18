import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Line, CreateLineRequest } from '@shared/models';
import { CrudResource } from './crud-resource';

@Injectable({
  providedIn: 'root'
})
export class LineService extends CrudResource<Line, CreateLineRequest> {
  protected readonly baseUrl = '/api/lines';
  protected readonly http = inject(HttpClient);

  getAll(): Observable<Line[]> {
    return this.getAllListed();
  }
}
