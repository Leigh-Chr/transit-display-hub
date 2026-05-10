import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { DisplayState } from '@shared/models';
import { BaseStompService } from './base-stomp.service';

@Injectable({
  providedIn: 'root'
})
export class HubWebSocketService extends BaseStompService {
  private updateSubject = new Subject<DisplayState>();
  private stopIds: string[] = [];

  constructor() {
    super();
    this.authService.logout$.subscribe(() => this.disconnect());
  }

  protected override buildBrokerUrl(): string {
    return BaseStompService.buildWsUrl();
  }

  protected override onConnect(): void {
    for (const stopId of this.stopIds) {
      this.subscribeToTopic<DisplayState>(
        `/topic/display/${stopId}`,
        (body) => JSON.parse(body) as DisplayState,
        (state) => this.updateSubject.next(state),
        `hub display state (${stopId})`,
      );
    }
  }

  connect(stopIds: string[]): Observable<DisplayState> {
    this.stopIds = stopIds;
    this.activateClient();
    return this.updateSubject.asObservable();
  }

  override disconnect(): void {
    super.disconnect();
    this.updateSubject.complete();
    this.updateSubject = new Subject<DisplayState>();
  }
}
