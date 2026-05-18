import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { EMPTY, of, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubComponent } from './hub.component';
import { DisplayService } from '@core/api/display.service';
import { HubWebSocketService } from '@core/websocket/hub-websocket.service';
import { HubDisplayState } from '@shared/models';
import { testTranslocoModule } from '../../../../test-translations';

const translocoLangs = {
  en: {
    common: {
      ariaLabel: { lineBadge: 'Line {{ code }} — {{ name }}' },
    },
    kiosk: {
      noArrivals: 'No upcoming departure',
      noScheduledDepartures: 'No scheduled departures',
      imminent: 'Imminent',
      minutesShort: '{{ minutes }} min',
      onTime: 'on time',
      headerLine: 'Line',
      headerPlatform: 'Platform',
      headerDestination: 'Destination',
      headerNextDeparture: 'Next departure',
      booking: { label: 'Reservation', aria: 'Reservation required' },
      connection: { reconnecting: 'Reconnecting…', stale: 'Last update {{ minutes }} min ago' },
      error: { title: 'Display Error' },
      loading: 'Loading…',
    },
  },
  fr: {
    common: {
      ariaLabel: { lineBadge: 'Ligne {{ code }} — {{ name }}' },
    },
    kiosk: {
      noArrivals: 'Aucun prochain départ',
      noScheduledDepartures: 'Aucun départ programmé',
      imminent: 'Imminent',
      minutesShort: '{{ minutes }} min',
      onTime: "à l'heure",
      headerLine: 'Ligne',
      headerPlatform: 'Quai',
      headerDestination: 'Destination',
      headerNextDeparture: 'Prochain départ',
      booking: { label: 'Réservation', aria: 'Réservation requise' },
      connection: { reconnecting: 'Reconnexion…', stale: 'Dernière mise à jour il y a {{ minutes }} min' },
      error: { title: "Erreur d'affichage" },
      loading: 'Chargement…',
    },
  },
};

const mockHubState: HubDisplayState = {
  hubName: 'Test Hub',
  lines: [],
  arrivals: [],
  messages: [],
  version: 1,
  generatedAt: new Date().toISOString(),
};

describe('HubComponent', () => {
  let mockDisplayService: { getHubState: ReturnType<typeof vi.fn> };
  let mockHubWsService: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof signal<boolean>>;
    reconnected$: typeof EMPTY;
  };
  let queryParamsSubject: Subject<Record<string, string>>;

  beforeEach(() => {
    // ThemeService / Angular CDK BreakpointObserver probe matchMedia eagerly;
    // happy-dom doesn't ship the API natively.
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

    queryParamsSubject = new Subject();

    mockDisplayService = {
      getHubState: vi.fn().mockReturnValue(of(mockHubState)),
    };

    mockHubWsService = {
      connect: vi.fn().mockReturnValue(EMPTY),
      disconnect: vi.fn(),
      isConnected: signal(true),
      reconnected$: EMPTY,
    };

    TestBed.configureTestingModule({
      imports: [
        HubComponent,
        testTranslocoModule(translocoLangs.en, translocoLangs.fr),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable(),
          },
        },
        { provide: DisplayService, useValue: mockDisplayService },
        { provide: HubWebSocketService, useValue: mockHubWsService },
      ],
    });
  });

  it('renders without errors', () => {
    const fixture = TestBed.createComponent(HubComponent);
    fixture.detectChanges();
    // Before query params arrive the component shows the loading state.
    expect(fixture.nativeElement.querySelector('.kiosk, .loading-state')).not.toBeNull();
  });

  it('shows hub state once stop IDs are provided', () => {
    const fixture = TestBed.createComponent(HubComponent);
    fixture.detectChanges();
    queryParamsSubject.next({ stopIds: 'stop-1,stop-2', name: 'Test Hub' });
    fixture.detectChanges();
    expect(mockDisplayService.getHubState).toHaveBeenCalledWith(['stop-1', 'stop-2'], 'Test Hub');
  });

  it('renders each header line badge with a descriptive aria-label so screen readers announce both code and name', () => {
    mockDisplayService.getHubState.mockReturnValue(of({
      ...mockHubState,
      lines: [
        { id: 'L1', code: 'M1', name: 'Metro Line 1', color: '#ff0000' },
        { id: 'L2', code: 'B7', name: 'Bus 7 Center', color: '#0000ff' },
      ],
    }));
    const fixture = TestBed.createComponent(HubComponent);
    fixture.detectChanges();
    queryParamsSubject.next({ stopIds: 'stop-1,stop-2', name: 'Test Hub' });
    fixture.detectChanges();

    const badges = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.header-line-badge')
    );
    expect(badges.length).toBe(2);
    expect(badges[0]?.getAttribute('aria-label')).toBe('Line M1 — Metro Line 1');
    expect(badges[1]?.getAttribute('aria-label')).toBe('Line B7 — Bus 7 Center');
  });
});
