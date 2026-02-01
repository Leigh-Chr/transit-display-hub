import { Injectable, signal, computed } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject, BehaviorSubject, timer } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { DisplayState } from '@shared/models';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private client: Client | null = null;
  private displayStateSubject = new Subject<DisplayState>();
  private connectionStateSignal = signal<ConnectionState>('DISCONNECTED');
  private stopId: string | null = null;
  private destroy$ = new Subject<void>();

  connectionState = this.connectionStateSignal.asReadonly();

  connect(stopId: string): Observable<DisplayState> {
    this.stopId = stopId;
    this.connectionStateSignal.set('CONNECTING');

    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this.connectionStateSignal.set('CONNECTED');
        this.subscribeToStop(stopId);
        this.startHeartbeat();
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
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.stopId = null;
    this.connectionStateSignal.set('DISCONNECTED');
  }

  private subscribeToStop(stopId: string): void {
    if (!this.client) return;

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
    timer(0, 30000).pipe(
      takeUntil(this.destroy$),
      tap(() => {
        if (this.client && this.client.connected) {
          this.client.publish({
            destination: '/app/device/heartbeat',
            body: JSON.stringify({ stopId: this.stopId })
          });
        }
      })
    ).subscribe();
  }
}
