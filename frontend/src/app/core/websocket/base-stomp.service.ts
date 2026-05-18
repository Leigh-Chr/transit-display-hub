import { computed, inject, Injectable, OnDestroy, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Client, IFrame, IMessage, StompConfig, StompSubscription } from '@stomp/stompjs';
import { Observable, Subject } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { STOMP_CLIENT_FACTORY } from './stomp-client.factory';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

/**
 * Handle returned by {@link BaseStompService#createPayloadStream}. The
 * caller emits with {@link emit} and exposes the live stream to
 * consumers via {@link observe}. The underlying Subject is completed
 * and replaced on every {@link BaseStompService#disconnect} so a
 * later reconnect doesn't push values into a completed stream — see
 * the per-service notes for the rationale on each subclass.
 */
export interface PayloadStream<T> {
  emit(value: T): void;
  observe(): Observable<T>;
}

@Injectable()
export abstract class BaseStompService implements OnDestroy {
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
  private readonly payloadStreamResets: (() => void)[] = [];

  constructor() {
    // Centralise the "log the user out → drop the socket" wiring. Tied to
    // the service's lifetime via takeUntilDestroyed so the subscription
    // collapses when the injector tearing down (HMR, test teardown, or a
    // future provider scope change). Subclasses used to do this in their
    // own constructor and leaked the subscription per instance.
    this.authService.logout$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.disconnect());
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.reconnectedSubject.complete();
  }

  protected abstract buildBrokerUrl(): string;

  /** Called after the STOMP session is fully established. Subclasses subscribe
   *  to their topics here. Guaranteed to be called with `this.client` non-null. */
  protected abstract onConnect(): void;

  /**
   * Hook for subclasses that need to inject extra native headers into
   * the STOMP CONNECT frame (e.g. a kiosk identification header). The
   * JWT authentication ride along the httpOnly ACCESS_TOKEN cookie —
   * the browser attaches it to the WebSocket upgrade automatically and
   * the server's HandshakeInterceptor (v1.7.0) lifts it from there —
   * so no Authorization header is pushed by default.
   */
  protected buildConnectHeaders(): Record<string, string> {
    return {};
  }

  protected activateClient(extraConfig?: Partial<StompConfig>): void {
    if (this.client) { return; }

    this._connectionState.set('CONNECTING');

    this.client = this.stompClientFactory({
      brokerURL: this.buildBrokerUrl(),
      connectHeaders: this.buildConnectHeaders(),
      // Jittered base delay so a fleet of kiosks that drop together
      // (network blip, broker restart) doesn't reconverge in lock-step
      // every five seconds — audit 2026-05-12 06-perf-observability P2.
      // Range 4–7 s on the first retry; @stomp/stompjs handles further
      // back-off automatically once the socket fails repeatedly.
      reconnectDelay: 4000 + Math.floor(Math.random() * 3000),
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

  /**
   * Create a payload stream the subclass uses to bridge inbound STOMP
   * frames to its public Observable. The base class then takes care of
   * completing + replacing the underlying Subject every time
   * {@link disconnect} is called, so the three subclasses no longer
   * need to override disconnect just to manage their payload stream's
   * lifecycle.
   */
  protected createPayloadStream<T>(): PayloadStream<T> {
    let subject = new Subject<T>();
    this.payloadStreamResets.push(() => {
      subject.complete();
      subject = new Subject<T>();
    });
    return {
      emit: (value: T) => subject.next(value),
      observe: () => subject.asObservable(),
    };
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
      // deactivate() returns a Promise that resolves once the broker
      // acknowledges DISCONNECT. We don't await it (callers expect a
      // synchronous teardown signal) but we do trap the rejection so a
      // late socket error doesn't surface as an UnhandledPromiseRejection.
      this.client.deactivate().catch(() => undefined);
      this.client = null;
    }
    // Complete and replace each subclass-owned payload Subject so a
    // late frame can't push into a torn-down stream — the next
    // connect() observe() call returns the freshly-built Subject.
    for (const reset of this.payloadStreamResets) {
      reset();
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
