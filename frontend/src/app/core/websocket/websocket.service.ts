import { Injectable, inject, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject, timer } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { DisplayState } from '@shared/models';
import { AuthService } from '@core/auth/auth.service';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private readonly authService = inject(AuthService);
  private client: Client | null = null;
  private readonly displayStateSubject = new Subject<DisplayState>();
  private readonly connectionStateSignal = signal<ConnectionState>('DISCONNECTED');
  private deviceId: string | null = null;
  private destroy$ = new Subject<void>();
  private hasConnectedOnce = false;
  /** Emits each time the STOMP session re-opens after an interruption. Useful
   *  for downstream consumers (kiosk) that need to re-fetch a fresh snapshot
   *  via REST since pushes during the drop are lost. */
  private readonly reconnectedSubject = new Subject<void>();
  readonly reconnected$ = this.reconnectedSubject.asObservable();

  connectionState = this.connectionStateSignal.asReadonly();

  constructor() {
    // Drop the live STOMP session as soon as the user logs out, otherwise
    // the broker keeps pushing display state to a tab that no longer has a
    // token to authenticate further requests with.
    this.authService.logout$.subscribe(() => this.disconnect());
  }

  connect(stopId: string, deviceId: string | null = null): Observable<DisplayState> {
    this.deviceId = deviceId;
    this.connectionStateSignal.set('CONNECTING');

    const token = this.authService.getToken();
    const connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      connectHeaders,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this.connectionStateSignal.set('CONNECTED');
        this.subscribeToStop(stopId);
        this.startHeartbeat();
        if (this.hasConnectedOnce) {
          this.reconnectedSubject.next();
        }
        this.hasConnectedOnce = true;
      },
      onDisconnect: () => {
        this.connectionStateSignal.set('DISCONNECTED');
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
        this.connectionStateSignal.set('RECONNECTING');
      }
    });

    this.client.activate();

    return this.displayStateSubject.asObservable();
  }

  disconnect(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroy$ = new Subject<void>();
    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }
    this.deviceId = null;
    this.hasConnectedOnce = false;
    this.connectionStateSignal.set('DISCONNECTED');
  }

  private subscribeToStop(stopId: string): void {
    if (!this.client) {return;}

    this.client.subscribe(`/topic/display/${stopId}`, (message: IMessage) => {
      try {
        const displayState = JSON.parse(message.body) as DisplayState;
        this.displayStateSubject.next(displayState);
      } catch (e) {
        console.error('Failed to parse display state:', e);
      }
    });
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
