import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { NetworkMapUpdate } from '@shared/models';
import { BaseStompService } from './base-stomp.service';

@Injectable({
  providedIn: 'root'
})
export class NetworkMapWebSocketService extends BaseStompService {
  private updateSubject = new Subject<NetworkMapUpdate>();

  // Logout-on-disconnect is handled by BaseStompService.

  protected override buildBrokerUrl(): string {
    return BaseStompService.buildWsUrl();
  }

  protected override onConnect(): void {
    this.subscribeToTopic<NetworkMapUpdate>(
      '/topic/network-map',
      (body) => JSON.parse(body) as NetworkMapUpdate,
      (update) => this.updateSubject.next(update),
      'network map update',
    );
  }

  connect(): Observable<NetworkMapUpdate> {
    this.activateClient();
    return this.updateSubject.asObservable();
  }

  override disconnect(): void {
    super.disconnect();
    this.updateSubject.complete();
    this.updateSubject = new Subject<NetworkMapUpdate>();
  }
}
