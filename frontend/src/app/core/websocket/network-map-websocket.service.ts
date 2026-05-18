import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NetworkMapUpdate } from '@shared/models';
import { BaseStompService } from './base-stomp.service';

@Injectable({
  providedIn: 'root'
})
export class NetworkMapWebSocketService extends BaseStompService {
  // Subject lifecycle (complete + recreate on disconnect) handled by the base class.
  private readonly updateStream = this.createPayloadStream<NetworkMapUpdate>();

  protected override buildBrokerUrl(): string {
    return BaseStompService.buildWsUrl();
  }

  protected override onConnect(): void {
    this.subscribeToTopic<NetworkMapUpdate>(
      '/topic/network-map',
      (body) => JSON.parse(body) as NetworkMapUpdate,
      (update) => this.updateStream.emit(update),
      'network map update',
    );
  }

  connect(): Observable<NetworkMapUpdate> {
    this.activateClient();
    return this.updateStream.observe();
  }
}
