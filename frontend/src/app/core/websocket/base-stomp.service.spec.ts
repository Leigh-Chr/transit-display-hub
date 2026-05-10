import { TestBed } from '@angular/core/testing';
import { Injectable } from '@angular/core';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Client, StompConfig } from '@stomp/stompjs';
import { BaseStompService } from './base-stomp.service';
import { STOMP_CLIENT_FACTORY, StompClientFactory } from './stomp-client.factory';

// Minimal concrete subclass for testing the base behaviour.
@Injectable()
class TestStompService extends BaseStompService {
  connectedCalled = 0;

  protected override buildBrokerUrl(): string {
    return 'ws://localhost/ws';
  }

  protected override onConnect(): void {
    this.connectedCalled++;
  }

  /** Expose protected method for testing. */
  activateForTest(): void {
    this.activateClient();
  }

  /** Expose protected helper for testing. */
  subscribeForTest<T>(
    destination: string,
    parse: (body: string) => T,
    onMessage: (payload: T) => void,
  ) {
    return this.subscribeToTopic(destination, parse, onMessage, destination);
  }
}

interface MockStompClient {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  connected: boolean;
  config: StompConfig;
}

let mockClient: MockStompClient;

const factory: StompClientFactory = (config: StompConfig) => {
  mockClient = {
    activate: vi.fn(),
    deactivate: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    connected: false,
    config,
  };
  return mockClient as unknown as Client;
};

describe('BaseStompService', () => {
  let service: TestStompService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TestStompService,
        { provide: STOMP_CLIENT_FACTORY, useValue: factory },
      ],
    });
    service = TestBed.inject(TestStompService);
  });

  afterEach(() => {
    service.disconnect();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('connectionState', () => {
    it('should start as DISCONNECTED', () => {
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('should transition to CONNECTING when activateClient is called', () => {
      service.activateForTest();
      expect(service.connectionState()).toBe('CONNECTING');
    });

    it('should transition to CONNECTED when onConnect fires', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      expect(service.connectionState()).toBe('CONNECTED');
    });

    it('should transition to DISCONNECTED when onDisconnect fires', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      mockClient.config.onDisconnect!({} as never);
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('should transition to DISCONNECTED after disconnect()', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      service.disconnect();
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('should transition to RECONNECTING on STOMP error', () => {
      service.activateForTest();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      mockClient.config.onStompError!({ headers: {}, body: 'err' } as never);
      expect(service.connectionState()).toBe('RECONNECTING');
      consoleSpy.mockRestore();
    });
  });

  describe('isConnected', () => {
    it('should be false initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should be true when CONNECTED', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      expect(service.isConnected()).toBe(true);
    });

    it('should be false after disconnect', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('reconnected$', () => {
    it('should not emit on the first connection', () => {
      let count = 0;
      service.reconnected$.subscribe(() => count++);
      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      expect(count).toBe(0);
    });

    it('should emit when STOMP re-connects without an explicit disconnect (e.g. broker restart)', () => {
      let count = 0;
      service.reconnected$.subscribe(() => count++);

      service.activateForTest();
      // First connect — hasConnectedOnce goes from false → true.
      mockClient.config.onConnect!({} as never);
      // STOMP auto-reconnects (no explicit disconnect → hasConnectedOnce stays true).
      mockClient.config.onConnect!({} as never);
      expect(count).toBe(1);
    });

    it('should not emit after disconnect + reconnect (hasConnectedOnce resets)', () => {
      let count = 0;
      service.reconnected$.subscribe(() => count++);

      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      service.disconnect();

      // Fresh reconnect — treated as a first connection.
      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      expect(count).toBe(0);
    });
  });

  describe('activateClient guard', () => {
    it('should not create a second STOMP client if already active', () => {
      service.activateForTest();
      const first = mockClient;
      service.activateForTest();
      expect(mockClient).toBe(first);
    });

    it('should call activate on the STOMP client', () => {
      service.activateForTest();
      expect(mockClient.activate).toHaveBeenCalledOnce();
    });
  });

  describe('disconnect', () => {
    it('should call deactivate on the STOMP client', () => {
      service.activateForTest();
      service.disconnect();
      expect(mockClient.deactivate).toHaveBeenCalled();
    });

    it('should be safe to call when no client exists', () => {
      expect(() => service.disconnect()).not.toThrow();
    });

    it('should be safe to call twice', () => {
      service.activateForTest();
      service.disconnect();
      expect(() => service.disconnect()).not.toThrow();
    });

    it('should allow reactivation after disconnect', () => {
      service.activateForTest();
      service.disconnect();
      service.activateForTest();
      expect(mockClient.activate).toHaveBeenCalled();
    });
  });

  describe('onConnect callback', () => {
    it('should call the subclass onConnect hook', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);
      expect(service.connectedCalled).toBe(1);
    });
  });

  describe('subscribeToTopic', () => {
    it('should subscribe to the given destination after connect', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);

      const values: string[] = [];
      service.subscribeForTest('/topic/test', (body) => body, (v) => values.push(v));

      expect(mockClient.subscribe).toHaveBeenCalledWith('/topic/test', expect.any(Function));
    });

    it('should parse and forward messages', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);

      const values: { x: number }[] = [];
      service.subscribeForTest('/topic/test', (body) => JSON.parse(body) as { x: number }, (v) => values.push(v));

      const cb = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;
      cb({ body: '{"x":42}' });
      expect(values).toHaveLength(1);
      expect(values[0]!.x).toBe(42);
    });

    it('should catch and log parse errors without crashing', () => {
      service.activateForTest();
      mockClient.config.onConnect!({} as never);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      service.subscribeForTest('/topic/test', (_body) => { throw new Error('bad'); }, (_v) => { /* no-op */ });

      const cb = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;
      expect(() => cb({ body: 'anything' })).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
