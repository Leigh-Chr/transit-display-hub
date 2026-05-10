import { Injectable, inject, signal } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Observable, Subject } from 'rxjs';
import { DisplayState } from '@shared/models';
import { AuthService } from '@core/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class HubWebSocketService {
  private readonly authService = inject(AuthService);
  private client: Client | null = null;
  private subscriptions: StompSubscription[] = [];
  private updateSubject = new Subject<DisplayState>();
  private readonly connectedSignal = signal(false);
  private hasConnectedOnce = false;
  private readonly reconnectedSubject = new Subject<void>();
  readonly reconnected$ = this.reconnectedSubject.asObservable();

  isConnected = this.connectedSignal.asReadonly();

  constructor() {
    this.authService.logout$.subscribe(() => this.disconnect());
  }

  connect(stopIds: string[]): Observable<DisplayState> {
    if (this.client) {
      return this.updateSubject.asObservable();
    }

    const token = this.authService.getToken();
    const connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    this.client = new Client({
      brokerURL: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
      connectHeaders,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this.connectedSignal.set(true);
        if (this.hasConnectedOnce) {
          this.reconnectedSubject.next();
        }
        this.hasConnectedOnce = true;
        if (!this.client) { return; }
        for (const stopId of stopIds) {
          const sub = this.client.subscribe(`/topic/display/${stopId}`, (message: IMessage) => {
            try {
              const state = JSON.parse(message.body) as DisplayState;
              this.updateSubject.next(state);
            } catch (e) {
              console.error('Failed to parse hub display state:', e);
            }
          });
          this.subscriptions.push(sub);
        }
      },
      onDisconnect: () => {
        this.connectedSignal.set(false);
      },
      onStompError: (frame) => {
        console.error('Hub STOMP error:', frame);
        this.connectedSignal.set(false);
      }
    });

    this.client.activate();
    return this.updateSubject.asObservable();
  }

  disconnect(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }
    this.connectedSignal.set(false);
    this.hasConnectedOnce = false;
    this.updateSubject.complete();
    this.updateSubject = new Subject<DisplayState>();
  }
}
