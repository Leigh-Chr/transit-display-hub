import { InjectionToken } from '@angular/core';
import { Client, StompConfig } from '@stomp/stompjs';

export type StompClientFactory = (config: StompConfig) => Client;

/** Indirection so tests can swap the real STOMP `Client` for a fake without
 *  having to mock the ESM module — `vi.mock` does not interact reliably with
 *  Angular's DI-resolved instances under the unit-test builder. */
export const STOMP_CLIENT_FACTORY = new InjectionToken<StompClientFactory>(
  'STOMP_CLIENT_FACTORY',
  {
    providedIn: 'root',
    factory: () => (config: StompConfig) => new Client(config),
  },
);
