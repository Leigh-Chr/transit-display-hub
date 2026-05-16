import { TestBed, ComponentFixture } from '@angular/core/testing';
import { KioskComponent } from './kiosk.component';
import { DisplayService } from '@core/api/display.service';
import { WebSocketService, ConnectionState } from '@core/websocket/websocket.service';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, Subject, EMPTY, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DisplayState } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

const translocoLangs = {
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

describe('KioskComponent', () => {
  let component: KioskComponent;
  let fixture: ComponentFixture<KioskComponent>;
  let mockDisplayService: { getState: ReturnType<typeof vi.fn>; getStateByToken: ReturnType<typeof vi.fn> };
  let mockWsService: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; connectionState: ReturnType<typeof signal<ConnectionState>>; reconnected$: typeof EMPTY };
  let paramsSubject: Subject<Record<string, string>>;
  let queryParamsSubject: Subject<Record<string, string>>;

  const now = new Date();
  const futureHour = now.getHours() + 2;
  const futureTime = `${String(futureHour).padStart(2, '0')}:30:00`;

  const mockDisplayState: DisplayState = {
    stopId: 'stop-123',
    stopName: 'Central Station',
    lines: [{ id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' }],
    arrivals: [
      { scheduledTime: futureTime, destinationName: 'North Station', line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' } },
      { scheduledTime: futureTime, destinationName: 'South Station', line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' } }
    ],
    messages: [
      { title: 'Critical Alert', content: 'Service disruption', severity: 'CRITICAL' },
      { title: 'Info Notice', content: 'Normal service', severity: 'INFO' }
    ],
    version: 1,
    generatedAt: now.toISOString()
  };

  beforeEach(() => {
    paramsSubject = new Subject();
    queryParamsSubject = new Subject();

    // ThemeService probes matchMedia eagerly when injected; happy-dom
    // doesn't ship the API natively. Angular CDK's BreakpointObserver
    // additionally calls addListener / addEventListener on the
    // returned MediaQueryList, so the stub returns a fully-shaped
    // object — a bare {matches:false} would let the boot proceed but
    // unhandled errors would still flood vitest's run log.
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

    mockDisplayService = {
      getState: vi.fn().mockReturnValue(of(mockDisplayState)),
      getStateByToken: vi.fn().mockReturnValue(of({ deviceId: 'device-1', state: mockDisplayState }))
    };

    mockWsService = {
      connect: vi.fn().mockReturnValue(EMPTY),
      disconnect: vi.fn(),
      connectionState: signal<ConnectionState>('CONNECTED'),
      reconnected$: EMPTY
    };

    TestBed.configureTestingModule({
      imports: [
        KioskComponent,
        testTranslocoModule(translocoLangs.en, translocoLangs.fr),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: paramsSubject.asObservable(),
            queryParams: queryParamsSubject.asObservable()
          }
        },
        { provide: DisplayService, useValue: mockDisplayService },
        { provide: WebSocketService, useValue: mockWsService }
      ]
    });

    fixture = TestBed.createComponent(KioskComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization via stopId route param', () => {
    it('should load display state from route stopId', () => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      expect(mockDisplayService.getState).toHaveBeenCalledWith('stop-123');
    });

    it('should set displayState after loading', () => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      expect(component.displayState()).toEqual(mockDisplayState);
    });

    it('should subscribe to WebSocket updates', () => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      expect(mockWsService.connect).toHaveBeenCalledWith('stop-123', null);
    });
  });

  describe('initialization via token query param', () => {
    it('should load display state from token', () => {
      fixture.detectChanges();
      paramsSubject.next({});
      queryParamsSubject.next({ token: 'device-token-123' });

      expect(mockDisplayService.getStateByToken).toHaveBeenCalledWith('device-token-123');
    });
  });

  describe('computed signals', () => {
    beforeEach(() => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    it('should compute criticalMessages', () => {
      expect(component.criticalMessages().length).toBe(1);
      expect(component.criticalMessages()[0]!.title).toBe('Critical Alert');
    });

    it('should compute infoMessages', () => {
      expect(component.infoMessages().length).toBe(1);
      expect(component.infoMessages()[0]!.title).toBe('Info Notice');
    });

    it('should compute connected state', () => {
      expect(component.connected()).toBe(true);
    });

    it('should compute allArrivals filtering out past departures', () => {
      // The default arrivals are in the future, so they should all be present
      expect(component.allArrivals().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('duration computed signals', () => {
    beforeEach(() => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    it('should compute scrollDuration based on arrivals count', () => {
      // Default has 2 arrivals → 2*4=8 → Math.max(10,8)=10
      expect(component.scrollDuration()).toBe('10s');
    });

    it('should compute scrollDuration proportional to many arrivals', () => {
      const manyArrivals = Array.from({ length: 8 }, (_, i) => ({
        scheduledTime: `${String(futureHour).padStart(2, '0')}:${String(i + 10).padStart(2, '0')}:00`,
        destinationName: `Station ${i}`,
        line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' }
      }));
      component.displayState.set({ ...mockDisplayState, arrivals: manyArrivals });
      // 8*4=32 → "32s"
      expect(component.scrollDuration()).toBe('32s');
    });

    it('should compute tickerDuration based on info message length', () => {
      // Default: 1 info message "Info Notice" (11 chars title) + "Normal service" (14 chars content) = 25 chars
      // Math.max(10, 12 + Math.floor(25/50)*2) = Math.max(10, 12+0) = 12
      expect(component.tickerDuration()).toBe('12s');
    });

    it('should compute tickerDuration with longer messages', () => {
      component.displayState.set({
        ...mockDisplayState,
        messages: [
          { title: 'A'.repeat(30), content: 'B'.repeat(70), severity: 'INFO' },
          { title: 'C'.repeat(20), content: 'D'.repeat(30), severity: 'WARNING' }
        ]
      });
      // Total length: 30+70+20+30 = 150, floor(150/50)*2 = 6, max(10, 12+6) = 18
      expect(component.tickerDuration()).toBe('18s');
    });

    it('should compute alertDuration based on critical message length', () => {
      // Default: 1 critical message "Critical Alert" (14) + "Service disruption" (18) = 32
      // Math.max(12, 15 + floor(32/50)*3) = Math.max(12, 15+0) = 15
      expect(component.alertDuration()).toBe('15s');
    });

    it('should compute alertDuration with long critical messages', () => {
      component.displayState.set({
        ...mockDisplayState,
        messages: [
          { title: 'X'.repeat(50), content: 'Y'.repeat(100), severity: 'CRITICAL' }
        ]
      });
      // Total: 150, floor(150/50)*3 = 9, max(12, 15+9) = 24
      expect(component.alertDuration()).toBe('24s');
    });
  });

  describe('formatRelativeTime', () => {
    // Freeze the system clock at a stable HH:MM mid-day reference so the
    // "Imminent" / "1 min" / "N min" assertions can't straddle a minute
    // boundary between file load and test execution. The component reads
    // `new Date()` inside getMinutesUntil(), so faking the clock is the
    // safest way to make these assertions deterministic.
    const frozen = new Date(2025, 0, 15, 10, 30, 0, 0);

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(frozen);
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return minutes for future time', () => {
      const result = component.formatRelativeTime('12:30:00');
      expect(result).toContain('min');
    });

    it('should return Imminent for current time (0 minutes)', () => {
      const result = component.formatRelativeTime('10:30:00');
      expect(result).toBe('Imminent');
    });

    it('should return "1 min" for exactly 1 minute in the future', () => {
      const result = component.formatRelativeTime('10:31:00');
      expect(result).toBe('1 min');
    });

    it('should return "N min" for N minutes in the future', () => {
      const result = component.formatRelativeTime('10:45:00');
      expect(result).toBe('15 min');
    });
  });

  describe('formatDepartureTime', () => {
    beforeEach(() => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    it('should format HH:MM:SS to HH:MM', () => {
      expect(component.formatDepartureTime('14:30:00')).toBe('14:30');
    });

    it('should handle HH:MM format', () => {
      expect(component.formatDepartureTime('08:15')).toBe('08:15');
    });
  });

  describe('getMinutesUntil', () => {
    const frozen = new Date(2025, 0, 15, 10, 30, 0, 0);

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(frozen);
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return correct minute difference for future time', () => {
      // 10:30 → 12:45 = 2h15m = 135 min.
      expect(component.getMinutesUntil('12:45:00')).toBe(135);
    });

    it('should return 0 for current time', () => {
      expect(component.getMinutesUntil('10:30:00')).toBe(0);
    });
  });

  describe('needsScrolling', () => {
    beforeEach(() => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    it('should not need scrolling with few arrivals', () => {
      // Default mock has only 2 arrivals
      expect(component.needsScrolling()).toBe(false);
    });

    it('should need scrolling when many arrivals are present', () => {
      const manyArrivals = Array.from({ length: 10 }, (_, i) => ({
        scheduledTime: `${String(futureHour).padStart(2, '0')}:${String(i + 10).padStart(2, '0')}:00`,
        destinationName: `Station ${i}`,
        line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' },
      }));

      component.displayState.set({
        ...mockDisplayState,
        arrivals: manyArrivals,
      });

      expect(component.needsScrolling()).toBe(true);
    });
  });

  describe('message separation', () => {
    beforeEach(() => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    it('should separate critical messages from info messages', () => {
      expect(component.criticalMessages().length).toBe(1);
      expect(component.criticalMessages()[0]!.severity).toBe('CRITICAL');
      expect(component.infoMessages().length).toBe(1);
      expect(component.infoMessages()[0]!.severity).toBe('INFO');
    });

    it('should include WARNING in infoMessages (non-critical)', () => {
      component.displayState.set({
        ...mockDisplayState,
        messages: [
          { title: 'Warn', content: 'Something', severity: 'WARNING' },
          { title: 'Info', content: 'Normal', severity: 'INFO' },
          { title: 'Crit', content: 'Bad', severity: 'CRITICAL' },
        ],
      });

      expect(component.criticalMessages().length).toBe(1);
      expect(component.infoMessages().length).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should set error when missing both token and stopId', () => {
      fixture.detectChanges();
      paramsSubject.next({});
      queryParamsSubject.next({});

      expect(component.error()).toContain('Missing device token or stop ID');
    });
  });

  describe('connection state', () => {
    it('should show disconnected when ws is not connected', () => {
      mockWsService.connectionState = signal<ConnectionState>('DISCONNECTED');

      fixture = TestBed.createComponent(KioskComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      expect(component.connected()).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should disconnect WebSocket on destroy', () => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      fixture.destroy();

      expect(mockWsService.disconnect).toHaveBeenCalled();
    });
  });

  describe('error handling - getState failure', () => {
    it('should set error to "Stop not found." when getState returns an error', () => {
      mockDisplayService.getState.mockReturnValue(throwError(() => new Error('fail')));

      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-999' });
      queryParamsSubject.next({});

      expect(component.error()).toBe('Stop not found.');
      expect(component.displayState()).toBeNull();
    });
  });

  describe('error handling - getStateByToken failure', () => {
    it('should set error to "Invalid device token or device not found." when getStateByToken returns an error', () => {
      mockDisplayService.getStateByToken.mockReturnValue(throwError(() => new Error('fail')));

      fixture.detectChanges();
      paramsSubject.next({});
      queryParamsSubject.next({ token: 'bad-token' });

      expect(component.error()).toBe('Invalid device token or device not found.');
      expect(component.displayState()).toBeNull();
    });
  });

  describe('WebSocket update propagation', () => {
    it('should update displayState when WebSocket emits a new state', () => {
      const wsSubject = new Subject<DisplayState>();
      mockWsService.connect.mockReturnValue(wsSubject.asObservable());

      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      // Initial state is set from the HTTP call
      expect(component.displayState()).toEqual(mockDisplayState);

      const updatedState: DisplayState = {
        ...mockDisplayState,
        stopName: 'Updated Station',
        version: 2,
      };

      wsSubject.next(updatedState);

      expect(component.displayState()).toEqual(updatedState);
      expect(component.displayState()!.stopName).toBe('Updated Station');
    });

    it('should handle multiple WebSocket updates in sequence', () => {
      const wsSubject = new Subject<DisplayState>();
      mockWsService.connect.mockReturnValue(wsSubject.asObservable());

      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      const firstUpdate: DisplayState = { ...mockDisplayState, version: 2 };
      const secondUpdate: DisplayState = { ...mockDisplayState, version: 3, stopName: 'Final Name' };

      wsSubject.next(firstUpdate);
      expect(component.displayState()!.version).toBe(2);

      wsSubject.next(secondUpdate);
      expect(component.displayState()!.version).toBe(3);
      expect(component.displayState()!.stopName).toBe('Final Name');
    });
  });

  describe('query param stopId fallback', () => {
    it('should use query param stopId when route params has no stopId', () => {
      fixture.detectChanges();
      paramsSubject.next({});
      queryParamsSubject.next({ stopId: 'stop-fallback' });

      expect(mockDisplayService.getState).toHaveBeenCalledWith('stop-fallback');
    });

    it('should not use query param stopId when route param stopId is already set', () => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-route' });
      queryParamsSubject.next({ stopId: 'stop-query' });

      // getState should be called with the route param, not the query param
      expect(mockDisplayService.getState).toHaveBeenCalledWith('stop-route');
      expect(mockDisplayService.getState).not.toHaveBeenCalledWith('stop-query');
    });

    it('should prefer token over query param stopId', () => {
      fixture.detectChanges();
      paramsSubject.next({});
      queryParamsSubject.next({ token: 'device-token', stopId: 'stop-query' });

      expect(mockDisplayService.getStateByToken).toHaveBeenCalledWith('device-token');
      expect(mockDisplayService.getState).not.toHaveBeenCalled();
    });
  });

  describe('needsScrolling adjusted by messages', () => {
    it('should reduce maxVisible when critical messages are present', () => {
      // With 3 critical messages, maxVisible is reduced:
      // Math.max(3, Math.min(6, 5 - 3 + 0)) = Math.max(3, Math.min(6, 2)) = Math.max(3, 2) = 3
      // So 4 arrivals should trigger scrolling
      const fourArrivals = Array.from({ length: 4 }, (_, i) => ({
        scheduledTime: `${String(futureHour).padStart(2, '0')}:${String(i + 10).padStart(2, '0')}:00`,
        destinationName: `Station ${i}`,
        line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' },
      }));

      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      component.displayState.set({
        ...mockDisplayState,
        arrivals: fourArrivals,
        messages: [
          { title: 'Alert 1', content: 'Content 1', severity: 'CRITICAL' },
          { title: 'Alert 2', content: 'Content 2', severity: 'CRITICAL' },
          { title: 'Alert 3', content: 'Content 3', severity: 'CRITICAL' },
        ],
      });

      expect(component.needsScrolling()).toBe(true);
    });

    it('should allow one more visible row when no info messages are present', () => {
      // With 0 critical, 0 info messages:
      // maxVisible = Math.max(3, Math.min(6, 5 - 0 + 1)) = Math.max(3, Math.min(6, 6)) = 6
      // So 6 arrivals should NOT scroll, but 7 should
      const sixArrivals = Array.from({ length: 6 }, (_, i) => ({
        scheduledTime: `${String(futureHour).padStart(2, '0')}:${String(i + 10).padStart(2, '0')}:00`,
        destinationName: `Station ${i}`,
        line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' },
      }));

      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      component.displayState.set({
        ...mockDisplayState,
        arrivals: sixArrivals,
        messages: [],
      });

      expect(component.needsScrolling()).toBe(false);

      // Add one more arrival to exceed the threshold
      const sevenArrivals = [...sixArrivals, {
        scheduledTime: `${String(futureHour).padStart(2, '0')}:16:00`,
        destinationName: 'Station 6',
        line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' },
      }];

      component.displayState.set({
        ...mockDisplayState,
        arrivals: sevenArrivals,
        messages: [],
      });

      expect(component.needsScrolling()).toBe(true);
    });

    it('should not reduce maxVisible below 3 regardless of critical count', () => {
      // Even with many critical messages, maxVisible floors at 3
      // Math.max(3, Math.min(6, 5 - 10 + 0)) = Math.max(3, Math.min(6, -5)) = Math.max(3, -5) = 3
      const threeArrivals = Array.from({ length: 3 }, (_, i) => ({
        scheduledTime: `${String(futureHour).padStart(2, '0')}:${String(i + 10).padStart(2, '0')}:00`,
        destinationName: `Station ${i}`,
        line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' },
      }));

      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});

      component.displayState.set({
        ...mockDisplayState,
        arrivals: threeArrivals,
        messages: Array.from({ length: 10 }, (_, i) => ({
          title: `Alert ${i}`,
          content: `Content ${i}`,
          severity: 'CRITICAL' as const,
        })),
      });

      // 3 arrivals should not scroll because maxVisible is floored at 3
      expect(component.needsScrolling()).toBe(false);
    });
  });
});
