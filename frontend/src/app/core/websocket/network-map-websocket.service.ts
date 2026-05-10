import { Injectable, inject, signal } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { Observable, Subject } from 'rxjs';
import { NetworkMapUpdate } from '@shared/models';
import { AuthService } from '@core/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class NetworkMapWebSocketService {
  private readonly authService = inject(AuthService);
  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private updateSubject = new Subject<NetworkMapUpdate>();
  private readonly connected = signal(false);
  private hasConnectedOnce = false;
  private readonly reconnectedSubject = new Subject<void>();
  readonly reconnected$ = this.reconnectedSubject.asObservable();

  isConnected = this.connected.asReadonly();

  constructor() {
    this.authService.logout$.subscribe(() => this.disconnect());
  }

  connect(): Observable<NetworkMapUpdate> {
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
        this.connected.set(true);
        if (this.hasConnectedOnce) {
          this.reconnectedSubject.next();
        }
        this.hasConnectedOnce = true;
        if (!this.client) {return;}
        this.subscription = this.client.subscribe('/topic/network-map', (message: IMessage) => {
          try {
            const update = JSON.parse(message.body) as NetworkMapUpdate;
            this.updateSubject.next(update);
          } catch (e) {
            console.error('Failed to parse network map update:', e);
          }
        });
      },
      onDisconnect: () => {
        this.connected.set(false);
      },
      onStompError: (frame) => {
        console.error('Network map STOMP error:', frame);
        this.connected.set(false);
      }
    });

    this.client.activate();
    return this.updateSubject.asObservable();
  }

  disconnect(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }
    this.connected.set(false);
    this.hasConnectedOnce = false;
    this.updateSubject.complete();
    this.updateSubject = new Subject<NetworkMapUpdate>();
  }
}
