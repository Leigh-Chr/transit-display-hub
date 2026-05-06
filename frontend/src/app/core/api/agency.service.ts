import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Agency } from '@shared/models';

/**
 * Reads the agencies that operate the network. Most installs see a single
 * row; multi-agency feeds (operator + concessionnaire) expose every entry
 * declared in {@code agency.txt}.
 */
@Injectable({ providedIn: 'root' })
export class AgencyService {
  private readonly http = inject(HttpClient);

  getAllAgencies(): Observable<Agency[]> {
    return this.http.get<Agency[]>('/api/agencies');
  }
}
