import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Observable } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Client, StompConfig } from '@stomp/stompjs';
import { HubWebSocketService } from './hub-websocket.service';
import { STOMP_CLIENT_FACTORY, StompClientFactory } from './stomp-client.factory';
import { DisplayState } from '@shared/models';

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

describe('HubWebSocketService', () => {
  let service: HubWebSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: STOMP_CLIENT_FACTORY, useValue: factory },
      ],
    });
    service = TestBed.inject(HubWebSocketService);
  });

  afterEach(() => {
    service.disconnect();
  });
  describe('connect', () => {
    it('should return an observable without throwing', () => {
      const obs = service.connect(['stop-1', 'stop-2']);
      expect(obs).toBeInstanceOf(Observable);
    });

    it('should activate the STOMP client', () => {
      service.connect(['stop-1']);
      expect(mockClient.activate).toHaveBeenCalled();
    });

    it('should subscribe to /topic/display/{stopId} once connected', () => {
      service.connect(['stop-1', 'stop-2']);
      mockClient.config.onConnect!({} as never);

      expect(mockClient.subscribe).toHaveBeenCalledTimes(2);
      const destinations = mockClient.subscribe.mock.calls.map(c => c[0]);
      expect(destinations).toContain('/topic/display/stop-1');
      expect(destinations).toContain('/topic/display/stop-2');
    });

    it('should not subscribe to anything when no stop ids are passed', () => {
      service.connect([]);
      mockClient.config.onConnect!({} as never);
      expect(mockClient.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should emit DisplayState payloads parsed from the topic body', () => {
      const values: DisplayState[] = [];
      const obs = service.connect(['stop-1']);
      obs.subscribe(v => values.push(v));

      mockClient.config.onConnect!({} as never);
      const subscribeCallback = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;

      const payload: DisplayState = {
        stopId: 'stop-1',
        stopName: 'Central',
        lines: [],
        arrivals: [],
        messages: [],
        version: 1,
        generatedAt: '2026-05-15T10:00:00Z',
      };
      subscribeCallback({ body: JSON.stringify(payload) });

      expect(values).toHaveLength(1);
      expect(values[0]!.stopId).toBe('stop-1');
    });

    it('should swallow malformed message bodies without crashing the subscriber', () => {
      const values: DisplayState[] = [];
      const obs = service.connect(['stop-1']);
      obs.subscribe(v => values.push(v));

      mockClient.config.onConnect!({} as never);
      const subscribeCallback = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* noop */ });
      expect(() => subscribeCallback({ body: 'not-json' })).not.toThrow();
      expect(values).toHaveLength(0);
      consoleSpy.mockRestore();
    });
  });

  describe('disconnect', () => {
    it('should be safe to call before connect', () => {
      expect(() => service.disconnect()).not.toThrow();
    });

    it('should allow a fresh subscribe pipeline after disconnect', () => {
      const obs1 = service.connect(['stop-1']);
      expect(obs1).toBeInstanceOf(Observable);

      service.disconnect();

      const obs2 = service.connect(['stop-2']);
      expect(obs2).toBeInstanceOf(Observable);
      // The completed subject was rebuilt; a new emission still flows.
      const values: DisplayState[] = [];
      obs2.subscribe(v => values.push(v));

      mockClient.config.onConnect!({} as never);
      const cb = mockClient.subscribe.mock.calls[0]![1] as (m: { body: string }) => void;
      cb({ body: JSON.stringify({ stopId: 'stop-2', stopName: '', lines: [], arrivals: [], messages: [], version: 1, generatedAt: '' }) });
      expect(values).toHaveLength(1);
    });
  });
});
