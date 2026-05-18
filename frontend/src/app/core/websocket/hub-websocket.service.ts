import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DisplayState } from '@shared/models';
import { BaseStompService } from './base-stomp.service';

@Injectable({
  providedIn: 'root'
})
export class HubWebSocketService extends BaseStompService {
  // Subject lifecycle (complete + recreate on disconnect) handled by the base class.
  private readonly updateStream = this.createPayloadStream<DisplayState>();
  private stopIds: string[] = [];

  protected override buildBrokerUrl(): string {
    return BaseStompService.buildWsUrl();
  }

  protected override onConnect(): void {
    for (const stopId of this.stopIds) {
      this.subscribeToTopic<DisplayState>(
        `/topic/display/${stopId}`,
        (body) => JSON.parse(body) as DisplayState,
        (state) => this.updateStream.emit(state),
        `hub display state (${stopId})`,
      );
    }
  }

  connect(stopIds: string[]): Observable<DisplayState> {
    this.stopIds = stopIds;
    this.activateClient();
    return this.updateStream.observe();
  }
}
