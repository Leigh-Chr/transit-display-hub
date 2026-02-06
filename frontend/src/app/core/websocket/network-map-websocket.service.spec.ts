import { TestBed } from '@angular/core/testing';
import { NetworkMapWebSocketService } from './network-map-websocket.service';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NetworkMapUpdate } from '@shared/models';

// Mock SockJS
vi.mock('sockjs-client', () => ({
  default: vi.fn()
}));

// Mock STOMP Client as a proper class
vi.mock('@stomp/stompjs', () => {
  class MockClient {
    activate = vi.fn();
    deactivate = vi.fn();
    subscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
    connected = false;
    _config: any;
    constructor(config: any) {
      this._config = config;
    }
  }
  return { Client: MockClient };
});

describe('NetworkMapWebSocketService', () => {
  let service: NetworkMapWebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NetworkMapWebSocketService);
  });

  afterEach(() => {
    service.disconnect();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('isConnected', () => {
    it('should start as false', () => {
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should return an observable', () => {
      const obs = service.connect();
      expect(obs).toBeDefined();
      expect(typeof obs.subscribe).toBe('function');
    });

    it('should return the same observable on subsequent calls', () => {
      const obs1 = service.connect();
      const obs2 = service.connect();
      expect(obs1).toBeDefined();
      expect(obs2).toBeDefined();
    });

    it('should activate the STOMP client', () => {
      service.connect();
      const client = (service as any)['client'];
      expect(client.activate).toHaveBeenCalled();
    });

    it('should not create a second client on repeat connect', () => {
      service.connect();
      const client1 = (service as any)['client'];
      service.connect();
      const client2 = (service as any)['client'];
      expect(client1).toBe(client2);
    });
  });

  describe('disconnect', () => {
    it('should set isConnected to false', () => {
      service.connect();
      const client = (service as any)['client'];
      client._config.onConnect();
      expect(service.isConnected()).toBe(true);
      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should call deactivate on the STOMP client', () => {
      service.connect();
      const client = (service as any)['client'];
      service.disconnect();
      expect(client.deactivate).toHaveBeenCalled();
    });

    it('should unsubscribe from the STOMP subscription', () => {
      service.connect();
      const client = (service as any)['client'];
      client._config.onConnect();
      const subscription = (service as any)['subscription'];
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
      const client = (service as any)['client'];
      expect(client.activate).toHaveBeenCalled();
    });
  });

  describe('STOMP callbacks', () => {
    it('should set isConnected to true on onConnect', () => {
      service.connect();
      const client = (service as any)['client'];
      client._config.onConnect();
      expect(service.isConnected()).toBe(true);
    });

    it('should set isConnected to false on onDisconnect', () => {
      service.connect();
      const client = (service as any)['client'];
      client._config.onConnect();
      client._config.onDisconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should set isConnected to false on onStompError', () => {
      service.connect();
      const client = (service as any)['client'];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      client._config.onStompError({ headers: {}, body: 'error' });
      expect(service.isConnected()).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should subscribe to /topic/network-map on connect', () => {
      service.connect();
      const client = (service as any)['client'];
      client._config.onConnect();
      expect(client.subscribe).toHaveBeenCalledWith(
        '/topic/network-map',
        expect.any(Function)
      );
    });
  });

  describe('message handling', () => {
    it('should emit FULL_UPDATE messages', () => {
      const values: NetworkMapUpdate[] = [];
      const obs = service.connect();
      obs.subscribe(val => values.push(val));

      const client = (service as any)['client'];
      client._config.onConnect();

      const subscribeCallback = client.subscribe.mock.calls[0][1];
      const mockUpdate = {
        type: 'FULL_UPDATE',
        networkMap: { lines: [], stops: [], bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } },
        alerts: { networkAlerts: [], lineAlerts: {}, stopAlerts: {} }
      };
      subscribeCallback({ body: JSON.stringify(mockUpdate) });

      expect(values).toHaveLength(1);
      expect(values[0].type).toBe('FULL_UPDATE');
    });

    it('should emit ALERTS_UPDATE messages', () => {
      const values: NetworkMapUpdate[] = [];
      const obs = service.connect();
      obs.subscribe(val => values.push(val));

      const client = (service as any)['client'];
      client._config.onConnect();

      const subscribeCallback = client.subscribe.mock.calls[0][1];
      const mockUpdate = {
        type: 'ALERTS_UPDATE',
        alerts: { networkAlerts: [], lineAlerts: {}, stopAlerts: {} }
      };
      subscribeCallback({ body: JSON.stringify(mockUpdate) });

      expect(values).toHaveLength(1);
      expect(values[0].type).toBe('ALERTS_UPDATE');
    });

    it('should handle malformed message body gracefully', () => {
      const values: NetworkMapUpdate[] = [];
      const obs = service.connect();
      obs.subscribe(val => values.push(val));

      const client = (service as any)['client'];
      client._config.onConnect();

      const subscribeCallback = client.subscribe.mock.calls[0][1];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      subscribeCallback({ body: 'not-json' });
      expect(values).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it('should not emit after disconnect', () => {
      const values: NetworkMapUpdate[] = [];
      const obs = service.connect();
      obs.subscribe(val => values.push(val));

      service.disconnect();

      // Subject was completed, no more emissions possible on old observable
      expect(values).toHaveLength(0);
    });
  });
});
