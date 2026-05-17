import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { EMPTY, of, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { DisplayService } from '@core/api/display.service';
import { ConnectionState, WebSocketService } from '@core/websocket/websocket.service';
import { DisplayState } from '@shared/models';

import { KioskComponent } from './kiosk.component';
import { testTranslocoModule } from '../../../../test-translations';

/**
 * Shared fixtures, mocks and Transloco dictionary for every kiosk
 * spec file. The original spec was the largest in the project
 * (~700 lines, 39 tests) so it was split by domain — every spec
 * imports {@link setupKioskFixture} to skip the boilerplate.
 */
const KIOSK_TRANSLATIONS = {
  en: {
    kiosk: {
      errors: {
        missingDeviceOrStop: 'Missing device token or stop ID. Configure the display URL with /display/:stopId, ?token=<device-token>, or ?stopId=<stop-id>',
        invalidToken: 'Invalid device token or device not found.',
        stopNotFound: 'Stop not found.',
      },
      noArrivals: 'No upcoming departure',
      noScheduledDepartures: 'No scheduled departures',
      imminent: 'Imminent',
      minutesShort: '{{ minutes }} min',
      onTime: 'on time',
      pickup: {
        dropOffOnly: 'Drop-off only',
        pickupOnly: 'Pick-up only',
        onRequestAgency: 'On request — call agency',
        onRequestDriver: 'On request — wave the driver',
      },
      frequency: { everyMinute: 'Every minute', everyMinutes: 'Every {{ minutes }} min' },
      booking: { label: 'Reservation', aria: 'Reservation required' },
      accessibility: {
        wheelchairYes: 'Wheelchair accessible',
        wheelchairNo: 'Not wheelchair accessible',
        bikesAllowed: 'Bicycles allowed',
        platform: 'Platform {{ code }}',
        liveData: 'Live data',
      },
      connection: { reconnecting: 'Reconnecting…', stale: 'Last update {{ minutes }} min ago' },
      error: { title: 'Display Error' },
      loading: 'Loading…',
      highContrast: 'High-contrast mode',
      largeText: 'Larger text',
      speakNext: 'Read the next departure aloud',
      headerLine: 'Line',
      headerDestination: 'Destination',
      headerNextDeparture: 'Next departure',
      speak: {
        noArrivals: 'No upcoming departure to announce.',
        next: 'Next departure: line {{ line }}, towards {{ destination }}, at {{ time }}.',
        nextOnTime: 'Next departure: line {{ line }}, towards {{ destination }}, at {{ time }}, on time.',
        nextDelayed: 'Next departure: line {{ line }}, towards {{ destination }}, at {{ time }}, delayed by {{ minutes }} minutes.',
        nextEarly: 'Next departure: line {{ line }}, towards {{ destination }}, at {{ time }}, {{ minutes }} minutes early.',
      },
    },
  },
  fr: {
    kiosk: {
      errors: {
        missingDeviceOrStop: "Jeton de borne ou identifiant d'arrêt manquant. Configurez l'URL d'affichage avec /display/:stopId, ?token=<jeton>, ou ?stopId=<id-arrêt>",
        invalidToken: 'Jeton de borne invalide ou borne introuvable.',
        stopNotFound: 'Arrêt introuvable.',
      },
      noArrivals: 'Aucun prochain départ',
      noScheduledDepartures: 'Aucun départ programmé',
      imminent: 'Imminent',
      minutesShort: '{{ minutes }} min',
      onTime: "à l'heure",
      pickup: {
        dropOffOnly: 'Descente uniquement',
        pickupOnly: 'Montée uniquement',
        onRequestAgency: 'Sur réservation — appelez la centrale',
        onRequestDriver: "Sur demande — faites signe au conducteur",
      },
      frequency: { everyMinute: 'Toutes les minutes', everyMinutes: 'Toutes les {{ minutes }} min' },
      booking: { label: 'Réservation', aria: 'Réservation requise' },
      accessibility: {
        wheelchairYes: 'Accessible en fauteuil roulant',
        wheelchairNo: 'Non accessible en fauteuil roulant',
        bikesAllowed: 'Vélos autorisés',
        platform: 'Quai {{ code }}',
        liveData: 'Données temps réel',
      },
      connection: { reconnecting: 'Reconnexion…', stale: 'Dernière mise à jour il y a {{ minutes }} min' },
      error: { title: "Erreur d'affichage" },
      loading: 'Chargement…',
      highContrast: 'Mode contraste élevé',
      largeText: 'Texte plus grand',
      speakNext: 'Lire le prochain départ à voix haute',
      headerLine: 'Ligne',
      headerDestination: 'Destination',
      headerNextDeparture: 'Prochain départ',
      speak: {
        noArrivals: "Aucun prochain départ à annoncer.",
        next: 'Prochain départ : ligne {{ line }}, vers {{ destination }}, à {{ time }}.',
        nextOnTime: "Prochain départ : ligne {{ line }}, vers {{ destination }}, à {{ time }}, à l'heure.",
        nextDelayed: 'Prochain départ : ligne {{ line }}, vers {{ destination }}, à {{ time }}, en retard de {{ minutes }} minutes.',
        nextEarly: 'Prochain départ : ligne {{ line }}, vers {{ destination }}, à {{ time }}, en avance de {{ minutes }} minutes.',
      },
    },
  },
};

export interface KioskFixture {
  component: KioskComponent;
  fixture: ComponentFixture<KioskComponent>;
  mockDisplayService: { getState: ReturnType<typeof vi.fn>; getStateByToken: ReturnType<typeof vi.fn> };
  mockWsService: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    connectionState: ReturnType<typeof signal<ConnectionState>>;
    reconnected$: typeof EMPTY;
  };
  paramsSubject: Subject<Record<string, string>>;
  queryParamsSubject: Subject<Record<string, string>>;
  mockDisplayState: DisplayState;
}

/**
 * Boot a `KioskComponent` test fixture with the standard
 * "Central Station / 2 future arrivals / critical + info messages"
 * mock state, an `ActivatedRoute` driven by the returned Subjects,
 * and stubbed `DisplayService` + `WebSocketService` providers.
 */
export function setupKioskFixture(): KioskFixture {
  const paramsSubject = new Subject<Record<string, string>>();
  const queryParamsSubject = new Subject<Record<string, string>>();

  const now = new Date();
  const futureHour = now.getHours() + 2;
  const futureTime = `${String(futureHour).padStart(2, '0')}:30:00`;

  const mockDisplayState: DisplayState = {
    stopId: 'stop-123',
    stopName: 'Central Station',
    lines: [{ id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' }],
    arrivals: [
      { scheduledTime: futureTime, destinationName: 'North Station', line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' } },
      { scheduledTime: futureTime, destinationName: 'South Station', line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' } },
    ],
    messages: [
      { title: 'Critical Alert', content: 'Service disruption', severity: 'CRITICAL' },
      { title: 'Info Notice', content: 'Normal service', severity: 'INFO' },
    ],
    version: 1,
    generatedAt: now.toISOString(),
  };

  // ThemeService probes matchMedia eagerly when injected; happy-dom
  // doesn't ship the API natively. Angular CDK's BreakpointObserver
  // additionally calls addListener / addEventListener on the returned
  // MediaQueryList, so the stub returns a fully-shaped object.
  (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia =
    vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn().mockReturnValue(false),
    });

  const mockDisplayService = {
    getState: vi.fn().mockReturnValue(of(mockDisplayState)),
    getStateByToken: vi.fn().mockReturnValue(of({ deviceId: 'device-1', state: mockDisplayState })),
  };

  const mockWsService = {
    connect: vi.fn().mockReturnValue(EMPTY),
    disconnect: vi.fn(),
    connectionState: signal<ConnectionState>('CONNECTED'),
    reconnected$: EMPTY,
  };

  TestBed.configureTestingModule({
    imports: [
      KioskComponent,
      testTranslocoModule(KIOSK_TRANSLATIONS.en, KIOSK_TRANSLATIONS.fr),
    ],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          params: paramsSubject.asObservable(),
          queryParams: queryParamsSubject.asObservable(),
        },
      },
      { provide: DisplayService, useValue: mockDisplayService },
      { provide: WebSocketService, useValue: mockWsService },
    ],
  });

  const fixture = TestBed.createComponent(KioskComponent);
  const component = fixture.componentInstance;

  return {
    component,
    fixture,
    mockDisplayService,
    mockWsService,
    paramsSubject,
    queryParamsSubject,
    mockDisplayState,
  };
}
