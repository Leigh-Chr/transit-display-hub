import { Injectable } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { DisplayState } from '@shared/models';
import { BaseStompService } from './base-stomp.service';

// Re-exported for consumers that typed it from this module.
export type { ConnectionState } from './base-stomp.service';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService extends BaseStompService {
  private readonly displayStateSubject = new Subject<DisplayState>();
  private deviceId: string | null = null;
  private stopId: string | null = null;

  // Logout-on-disconnect is handled by BaseStompService; no constructor needed.

  protected override buildBrokerUrl(): string {
    return BaseStompService.buildWsUrl();
  }

  protected override onConnect(): void {
    this.subscribeToStop();
    this.startHeartbeat();
  }

  connect(stopId: string, deviceId: string | null = null): Observable<DisplayState> {
    this.stopId = stopId;
    this.deviceId = deviceId;
    this.activateClient();
    return this.displayStateSubject.asObservable();
  }

  override disconnect(): void {
    super.disconnect();
    this.deviceId = null;
    this.stopId = null;
  }

  private subscribeToStop(): void {
    if (!this.stopId) { return; }
    const stopId = this.stopId;
    this.subscribeToTopic<DisplayState>(
      `/topic/display/${stopId}`,
      (body) => JSON.parse(body) as DisplayState,
      (state) => this.displayStateSubject.next(state),
      'display state',
    );
  }

  private startHeartbeat(): void {
    if (!this.deviceId) { return; }
    const deviceId = this.deviceId;
    timer(0, 30000).pipe(
      takeUntil(this.destroy$),
      tap(() => {
        if (this.client?.connected) {
          this.client.publish({
            destination: '/app/device/heartbeat',
            body: JSON.stringify({ deviceId })
          });
        }
      })
    ).subscribe();
  }
}
