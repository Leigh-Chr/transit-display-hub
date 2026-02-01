import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Device, DeviceRegistration, RegisterDeviceRequest, DeviceStatus } from '@shared/models';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private readonly baseUrl = '/api/devices';

  constructor(private http: HttpClient) {}

  getAll(status?: DeviceStatus): Observable<Device[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Device[]>(this.baseUrl, { params });
  }

  get(id: string): Observable<Device> {
    return this.http.get<Device>(`${this.baseUrl}/${id}`);
  }

  register(request: RegisterDeviceRequest): Observable<DeviceRegistration> {
    return this.http.post<DeviceRegistration>(this.baseUrl, request);
  }

  update(id: string, request: RegisterDeviceRequest): Observable<Device> {
    return this.http.put<Device>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
