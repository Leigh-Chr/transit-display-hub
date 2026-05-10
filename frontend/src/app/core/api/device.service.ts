import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Device, DeviceRegistration, RegisterDeviceRequest, DeviceStatus } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private readonly baseUrl = '/api/devices';
  private readonly http = inject(HttpClient);

  getAll(status?: DeviceStatus): Observable<Device[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Device[]>(this.baseUrl, { params });
  }

  register(request: RegisterDeviceRequest): Observable<DeviceRegistration> {
    return this.http.post<DeviceRegistration>(this.baseUrl, request);
  }

  delete(id: string): Observable<void> {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- known typescript-eslint issue with expression-level generics
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
