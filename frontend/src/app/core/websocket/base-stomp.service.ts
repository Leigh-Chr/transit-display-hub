import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { Client, IFrame, IMessage, StompConfig, StompSubscription } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { STOMP_CLIENT_FACTORY } from './stomp-client.factory';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

@Injectable()
export abstract class BaseStompService {
  protected readonly authService = inject(AuthService);
  private readonly stompClientFactory = inject(STOMP_CLIENT_FACTORY);

  private readonly _connectionState = signal<ConnectionState>('DISCONNECTED');
  readonly connectionState: Signal<ConnectionState> = this._connectionState.asReadonly();
  readonly isConnected: Signal<boolean> = computed(() => this._connectionState() === 'CONNECTED');

  protected client: Client | null = null;
  protected destroy$ = new Subject<void>();
  protected hasConnectedOnce = false;
  private readonly reconnectedSubject = new Subject<void>();
  readonly reconnected$ = this.reconnectedSubject.asObservable();
  private stompSubscriptions: StompSubscription[] = [];

  protected abstract buildBrokerUrl(): string;

  /** Called after the STOMP session is fully established. Subclasses subscribe
   *  to their topics here. Guaranteed to be called with `this.client` non-null. */
  protected abstract onConnect(): void;

  protected buildConnectHeaders(): Record<string, string> {
    const token = this.authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  protected activateClient(extraConfig?: Partial<StompConfig>): void {
    if (this.client) { return; }

    this._connectionState.set('CONNECTING');

    this.client = this.stompClientFactory({
      brokerURL: this.buildBrokerUrl(),
      connectHeaders: this.buildConnectHeaders(),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this._connectionState.set('CONNECTED');
        if (this.hasConnectedOnce) {
          this.reconnectedSubject.next();
        }
        this.hasConnectedOnce = true;
        this.onConnect();
      },
      onDisconnect: () => {
        this._connectionState.set('DISCONNECTED');
      },
      onStompError: (frame: IFrame) => {
        this.handleStompError(frame);
      },
      ...extraConfig,
    });

    this.client.activate();
  }

  protected subscribeToTopic<T>(
    destination: string,
    parse: (body: string) => T,
    onMessage: (payload: T) => void,
    errorLabel?: string,
  ): StompSubscription | null {
    if (!this.client) { return null; }
    const sub = this.client.subscribe(destination, (msg: IMessage) => {
      try {
        onMessage(parse(msg.body));
      } catch (e) {
        console.error(`Failed to parse ${errorLabel ?? destination}:`, e);
      }
    });
    this.stompSubscriptions.push(sub);
    return sub;
  }

  disconnect(): void {
    for (const sub of this.stompSubscriptions) {
      sub.unsubscribe();
    }
    this.stompSubscriptions = [];
    this.destroy$.next();
    this.destroy$.complete();
    this.destroy$ = new Subject<void>();
    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }
    this.hasConnectedOnce = false;
    this._connectionState.set('DISCONNECTED');
  }

  protected handleStompError(frame: IFrame): void {
    console.error('STOMP error:', frame);
    this._connectionState.set('RECONNECTING');
  }

  protected static buildWsUrl(): string {
    return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
  }
}
