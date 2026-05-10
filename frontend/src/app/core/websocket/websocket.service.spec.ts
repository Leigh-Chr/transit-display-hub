import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { STOMP_CLIENT_FACTORY, StompClientFactory } from './stomp-client.factory';
import { DisplayState } from '@shared/models';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Client, StompConfig } from '@stomp/stompjs';

interface MockStompClient {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  connected: boolean;
  config: StompConfig;
}

let mockClient: MockStompClient;

const factory: StompClientFactory = (config: StompConfig) => {
  mockClient = {
    activate: vi.fn(),
    deactivate: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    publish: vi.fn(),
    connected: false,
    config,
  };
  return mockClient as unknown as Client;
};

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: STOMP_CLIENT_FACTORY, useValue: factory }],
    });
    service = TestBed.inject(WebSocketService);
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

    it('should transition to CONNECTING when connect is called', () => {
      service.connect('stop-123');
      expect(service.connectionState()).toBe('CONNECTING');
    });
  });

  describe('connect', () => {
    it('should return an observable', () => {
      const obs = service.connect('stop-123');
      expect(obs).toBeInstanceOf(Observable);
    });
  });

  describe('disconnect', () => {
    it('should set state to DISCONNECTED', () => {
      service.connect('stop-123');
      service.disconnect();
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('should not error on double disconnect', () => {
      service.disconnect();
      service.disconnect();
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('should handle disconnect after connect', () => {
      service.connect('stop-123');
      service.disconnect();
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('should call deactivate on the STOMP client', () => {
      service.connect('stop-123');
      service.disconnect();
      expect(mockClient.deactivate).toHaveBeenCalled();
    });

    it('should be a no-op when already disconnected with no prior connection', () => {
      expect(service.connectionState()).toBe('DISCONNECTED');
      service.disconnect();
      expect(service.connectionState()).toBe('DISCONNECTED');
    });
  });

  describe('multiple connect calls', () => {
    it('should not create duplicate clients on successive connect calls', () => {
      const obs1 = service.connect('stop-1');
      const obs2 = service.connect('stop-2');

      expect(obs1).toBeDefined();
      expect(obs2).toBeDefined();
      expect(service.connectionState()).toBe('CONNECTING');
    });
  });

  describe('connect observable', () => {
    it('should return a subscribable observable that does not immediately emit', () => {
      const values: DisplayState[] = [];
      const obs = service.connect('stop-123');

      obs.subscribe((val) => values.push(val));

      expect(values).toEqual([]);
    });
  });

  describe('STOMP callbacks', () => {
    it('should set state to CONNECTED on onConnect callback', () => {
      service.connect('stop-123');
      mockClient.config.onConnect!({} as never);
      expect(service.connectionState()).toBe('CONNECTED');
    });

    it('should set state to DISCONNECTED on onDisconnect callback', () => {
      service.connect('stop-123');
      mockClient.config.onConnect!({} as never);
      expect(service.connectionState()).toBe('CONNECTED');
      mockClient.config.onDisconnect!({} as never);
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('should set state to RECONNECTING on onStompError callback', () => {
      service.connect('stop-123');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      mockClient.config.onStompError!({ headers: {}, body: 'error' } as never);
      expect(service.connectionState()).toBe('RECONNECTING');
      consoleSpy.mockRestore();
    });

    it('should subscribe to the correct topic on connect', () => {
      service.connect('stop-456');
      mockClient.config.onConnect!({} as never);
      expect(mockClient.subscribe).toHaveBeenCalledWith(
        '/topic/display/stop-456',
        expect.any(Function),
      );
    });

    it('should emit parsed display state when message received', () => {
      const values: DisplayState[] = [];
      const obs = service.connect('stop-123');
      obs.subscribe(val => values.push(val));

      mockClient.config.onConnect!({} as never);

      const subscribeCallback = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;
      const mockState = { stopId: 'stop-123', stopName: 'Test', lines: [], arrivals: [], messages: [], version: 1, generatedAt: '' };
      subscribeCallback({ body: JSON.stringify(mockState) });

      expect(values).toHaveLength(1);
      expect(values[0]!.stopId).toBe('stop-123');
    });

    it('should handle malformed message body gracefully', () => {
      const values: DisplayState[] = [];
      const obs = service.connect('stop-123');
      obs.subscribe(val => values.push(val));

      mockClient.config.onConnect!({} as never);

      const subscribeCallback = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      subscribeCallback({ body: 'not-json' });
      expect(values).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it('should start heartbeat on connect when deviceId is provided and publish to correct destination', () => {
      vi.useFakeTimers();
      service.connect('stop-123', 'device-42');
      mockClient.connected = true;
      mockClient.config.onConnect!({} as never);

      vi.advanceTimersByTime(0);
      expect(mockClient.publish).toHaveBeenCalledWith({
        destination: '/app/device/heartbeat',
        body: JSON.stringify({ deviceId: 'device-42' }),
      });

      vi.useRealTimers();
    });

    it('should not publish heartbeats when no deviceId is provided', () => {
      vi.useFakeTimers();
      service.connect('stop-123');
      mockClient.connected = true;
      mockClient.config.onConnect!({} as never);

      vi.advanceTimersByTime(60_000);
      expect(mockClient.publish).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

});
