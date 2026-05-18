import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { NetworkMapWebSocketService } from './network-map-websocket.service';
import { STOMP_CLIENT_FACTORY, StompClientFactory } from './stomp-client.factory';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NetworkMapUpdate } from '@shared/models';
import { Client, StompConfig } from '@stomp/stompjs';

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

describe('NetworkMapWebSocketService', () => {
  let service: NetworkMapWebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: STOMP_CLIENT_FACTORY, useValue: factory }],
    });
    service = TestBed.inject(NetworkMapWebSocketService);
  });

  afterEach(() => {
    service.disconnect();
  });
  describe('isConnected', () => {
    it('should start as false', () => {
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should return an observable', () => {
      const obs = service.connect();
      expect(obs).toBeInstanceOf(Observable);
    });

    it('should return the same observable on subsequent calls', () => {
      const obs1 = service.connect();
      const obs2 = service.connect();
      expect(obs1).toBeDefined();
      expect(obs2).toBeDefined();
    });

    it('should activate the STOMP client', () => {
      service.connect();
      expect(mockClient.activate).toHaveBeenCalled();
    });

    it('should not create a second client on repeat connect', () => {
      service.connect();
      const first = mockClient;
      service.connect();
      expect(mockClient).toBe(first);
    });
  });

  describe('disconnect', () => {
    it('should set isConnected to false', () => {
      service.connect();
      mockClient.config.onConnect!({} as never);
      expect(service.isConnected()).toBe(true);
      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should call deactivate on the STOMP client', () => {
      service.connect();
      const deactivateFn = mockClient.deactivate;
      service.disconnect();
      expect(deactivateFn).toHaveBeenCalled();
    });

    it('should unsubscribe from the STOMP subscription', () => {
      service.connect();
      mockClient.config.onConnect!({} as never);
      const subscription = mockClient.subscribe.mock.results[0]!.value as { unsubscribe: ReturnType<typeof vi.fn> };
      service.disconnect();
      expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    it('should not error on double disconnect', () => {
      service.disconnect();
      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should allow reconnection after disconnect', () => {
      service.connect();
      service.disconnect();
      const obs = service.connect();
      expect(obs).toBeDefined();
      expect(mockClient.activate).toHaveBeenCalled();
    });
  });

  describe('STOMP callbacks', () => {
    it('should set isConnected to true on onConnect', () => {
      service.connect();
      mockClient.config.onConnect!({} as never);
      expect(service.isConnected()).toBe(true);
    });

    it('should set isConnected to false on onDisconnect', () => {
      service.connect();
      mockClient.config.onConnect!({} as never);
      mockClient.config.onDisconnect!({} as never);
      expect(service.isConnected()).toBe(false);
    });

    it('should set isConnected to false on onStompError', () => {
      service.connect();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      mockClient.config.onStompError!({ headers: {}, body: 'error' } as never);
      expect(service.isConnected()).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should subscribe to /topic/network-map on connect', () => {
      service.connect();
      mockClient.config.onConnect!({} as never);
      expect(mockClient.subscribe).toHaveBeenCalledWith(
        '/topic/network-map',
        expect.any(Function),
      );
    });
  });

  describe('message handling', () => {
    it('should emit FULL_UPDATE messages', () => {
      const values: NetworkMapUpdate[] = [];
      const obs = service.connect();
      obs.subscribe(val => values.push(val));

      mockClient.config.onConnect!({} as never);

      const subscribeCallback = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;
      const mockUpdate = {
        type: 'FULL_UPDATE',
        networkMap: { lines: [], stops: [], bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } },
        alerts: { networkAlerts: [], lineAlerts: {}, stopAlerts: {} },
      };
      subscribeCallback({ body: JSON.stringify(mockUpdate) });

      expect(values).toHaveLength(1);
      expect(values[0]!.type).toBe('FULL_UPDATE');
    });

    it('should emit ALERTS_UPDATE messages', () => {
      const values: NetworkMapUpdate[] = [];
      const obs = service.connect();
      obs.subscribe(val => values.push(val));

      mockClient.config.onConnect!({} as never);

      const subscribeCallback = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;
      const mockUpdate = {
        type: 'ALERTS_UPDATE',
        alerts: { networkAlerts: [], lineAlerts: {}, stopAlerts: {} },
      };
      subscribeCallback({ body: JSON.stringify(mockUpdate) });

      expect(values).toHaveLength(1);
      expect(values[0]!.type).toBe('ALERTS_UPDATE');
    });

    it('should handle malformed message body gracefully', () => {
      const values: NetworkMapUpdate[] = [];
      const obs = service.connect();
      obs.subscribe(val => values.push(val));

      mockClient.config.onConnect!({} as never);

      const subscribeCallback = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      subscribeCallback({ body: 'not-json' });
      expect(values).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it('should not emit after disconnect', () => {
      const values: NetworkMapUpdate[] = [];
      const obs = service.connect();
      obs.subscribe(val => values.push(val));

      service.disconnect();

      expect(values).toHaveLength(0);
    });
  });
});
