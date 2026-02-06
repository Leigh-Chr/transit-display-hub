import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NetworkMap, NetworkMapAlerts } from '@shared/models';

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
}
