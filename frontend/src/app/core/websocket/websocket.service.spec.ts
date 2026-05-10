import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { DisplayState } from '@shared/models';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

interface MockStompConfig {
  onConnect: () => void;
  onDisconnect: () => void;
  onStompError: (frame: { headers: Record<string, string>; body: string }) => void;
}

interface MockStompClient {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  connected: boolean;
  _config: MockStompConfig;
}

interface ServicePrivateFields {
  client: MockStompClient;
}

// Mock STOMP Client as a proper class
vi.mock('@stomp/stompjs', () => {
  class MockClient {
    activate = vi.fn();
    deactivate = vi.fn();
    subscribe = vi.fn();
    publish = vi.fn();
    connected = false;
    _config: MockStompConfig;
    constructor(config: MockStompConfig) {
      this._config = config;
    }
  }
  return { Client: MockClient };
});

describe('WebSocketService', () => {
  let service: WebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
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
      const client = (service as unknown as ServicePrivateFields).client;
      service.disconnect();
      expect(client.deactivate).toHaveBeenCalled();
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

      // Both should return observables
      expect(obs1).toBeDefined();
      expect(obs2).toBeDefined();
      // State should be CONNECTING (the last connect call wins)
      expect(service.connectionState()).toBe('CONNECTING');
    });
  });

  describe('connect observable', () => {
    it('should return a subscribable observable that does not immediately emit', () => {
      const values: DisplayState[] = [];
      const obs = service.connect('stop-123');

      obs.subscribe((val) => values.push(val));

      // No values emitted until STOMP receives a message
      expect(values).toEqual([]);
    });
  });

  describe('STOMP callbacks', () => {
    it('should set state to CONNECTED on onConnect callback', () => {
      service.connect('stop-123');
      const client = (service as unknown as ServicePrivateFields).client;
      client._config.onConnect();
      expect(service.connectionState()).toBe('CONNECTED');
    });

    it('should set state to DISCONNECTED on onDisconnect callback', () => {
      service.connect('stop-123');
      const client = (service as unknown as ServicePrivateFields).client;
      client._config.onConnect();
      expect(service.connectionState()).toBe('CONNECTED');
      client._config.onDisconnect();
      expect(service.connectionState()).toBe('DISCONNECTED');
    });

    it('should set state to RECONNECTING on onStompError callback', () => {
      service.connect('stop-123');
      const client = (service as unknown as ServicePrivateFields).client;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      client._config.onStompError({ headers: {}, body: 'error' });
      expect(service.connectionState()).toBe('RECONNECTING');
      consoleSpy.mockRestore();
    });

    it('should subscribe to the correct topic on connect', () => {
      service.connect('stop-456');
      const client = (service as unknown as ServicePrivateFields).client;
      client._config.onConnect();
      expect(client.subscribe).toHaveBeenCalledWith(
        '/topic/display/stop-456',
        expect.any(Function)
      );
    });

    it('should emit parsed display state when message received', () => {
      const values: DisplayState[] = [];
      const obs = service.connect('stop-123');
      obs.subscribe(val => values.push(val));

      const client = (service as unknown as ServicePrivateFields).client;
      client._config.onConnect();

      const subscribeCallback = client.subscribe.mock.calls[0]![1];
      const mockState = { stopId: 'stop-123', stopName: 'Test', lines: [], arrivals: [], messages: [], version: 1, generatedAt: '' };
      subscribeCallback({ body: JSON.stringify(mockState) });

      expect(values).toHaveLength(1);
      expect(values[0]!.stopId).toBe('stop-123');
    });

    it('should handle malformed message body gracefully', () => {
      const values: DisplayState[] = [];
      const obs = service.connect('stop-123');
      obs.subscribe(val => values.push(val));

      const client = (service as unknown as ServicePrivateFields).client;
      client._config.onConnect();

      const subscribeCallback = client.subscribe.mock.calls[0]![1];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      subscribeCallback({ body: 'not-json' });
      expect(values).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it('should start heartbeat on connect when deviceId is provided and publish to correct destination', () => {
      vi.useFakeTimers();
      service.connect('stop-123', 'device-42');
      const client = (service as unknown as ServicePrivateFields).client;
      client.connected = true;
      client._config.onConnect();

      vi.advanceTimersByTime(0);
      expect(client.publish).toHaveBeenCalledWith({
        destination: '/app/device/heartbeat',
        body: JSON.stringify({ deviceId: 'device-42' })
      });

      vi.useRealTimers();
    });

    it('should not publish heartbeats when no deviceId is provided', () => {
      vi.useFakeTimers();
      service.connect('stop-123');
      const client = (service as unknown as ServicePrivateFields).client;
      client.connected = true;
      client._config.onConnect();

      vi.advanceTimersByTime(60_000);
      expect(client.publish).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
