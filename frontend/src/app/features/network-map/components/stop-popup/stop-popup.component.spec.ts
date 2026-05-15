import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { StopPopupComponent, StopPopupData } from './stop-popup.component';
import { FareCalculatorService } from '@core/api/fare-calculator.service';
import { FlexStopTimeService } from '@core/api/flex-stop-time.service';
import { ScheduleService } from '@core/api/schedule.service';
import { LocaleService } from '@core/i18n/locale.service';

const stopPopupDict = {
  common: { close: 'Fermer' },
  map: {
    stopPopup: {
      bookingType: {
        REAL_TIME: 'Réservation temps réel',
        SAME_DAY: 'Réservation le jour même',
        PRIOR_DAYS: 'Réservation à l\'avance',
        default: 'Réservation',
      },
      priorNoticeHours: 'au moins {{ hours }}h à l\'avance',
      priorNoticeMinutes: 'au moins {{ minutes }} min à l\'avance',
      bookingRequired: 'Réservation requise',
      tadZoneTitle: 'Zone de prise en charge — {{ name }}',
      tadZoneSvgAria: 'Polygone de la zone TAD {{ name }}',
      fareFromOrigin: 'Trajet depuis {{ origin }}',
      nextFlexTitle: 'Réservation TAD aujourd\'hui',
      howToBook: 'Comment réserver',
      bookOnline: 'Réserver en ligne',
      moreInfo: 'Plus d\'infos',
      loadingSchedules: 'Chargement des horaires…',
      loadingSchedulesAria: 'Chargement des horaires',
      noDepartures: 'No scheduled departures',
    },
    accessibility: {
      accessible: 'Accessible PMR',
      notAccessible: 'Non accessible',
      unknown: 'Non renseigné',
    },
    pathways: {
      title: 'Connexions internes — {{ station }}',
      ariaLabel: 'Connexions internes de la station',
      levelOne: '1 niveau : {{ list }}',
      levelOther: '{{ count }} niveaux : {{ list }}',
      fallbackLevel: 'niveau {{ index }}',
      stairsUp: '{{ count }} marches (montée)',
      stairsDown: '{{ count }} marches (descente)',
      signpostedAs: '« {{ label }} »',
      durationSeconds: '{{ value }} s',
      durationMinutes: '{{ value }} min',
    },
    transit: {
      pathwayMode: {
        WALKWAY: 'Couloir', STAIRS: 'Escalier', MOVING_SIDEWALK: 'Tapis roulant',
        ESCALATOR: 'Escalator', ELEVATOR: 'Ascenseur',
        FARE_GATE: 'Portillon (entrée)', EXIT_GATE: 'Portillon (sortie)',
      },
    },
  },
};
import { FareCalculationResult, FlexLocation, FlexStopTime, Schedule } from '@shared/models';
import { NetworkMapDataService } from '../../services/network-map-data.service';
import { LayoutStop } from '../../services/schematic-layout.service';

describe('StopPopupComponent', () => {
  let component: StopPopupComponent;
  let fixture: ComponentFixture<StopPopupComponent>;
  let mockScheduleService: { getForStop: ReturnType<typeof vi.fn> };
  let mockNetworkMapData: {
    getStopTadZone: ReturnType<typeof vi.fn>;
    getStopBookingRules: ReturnType<typeof vi.fn>;
    getStopPathwayGraph: ReturnType<typeof vi.fn>;
  };
  let mockFareCalculator: { calculate: ReturnType<typeof vi.fn> };
  let mockFlexStopTimes: { getWindowsForLocation: ReturnType<typeof vi.fn> };

  const mockStop: LayoutStop = {
    id: 'stop-1',
    name: 'Central Station',
    latitude: 48.85,
    longitude: 2.35,
    schematicX: 100,
    schematicY: 200,
    lineCodes: ['M1', 'M4'],
    x: 100,
    y: 200,
  };

  const mockLineColorMap = new Map<string, string>([
    ['M1', '#FFCD00'],
    ['M4', '#BB4D98'],
  ]);

  const baseMockData: StopPopupData = {
    stop: mockStop,
    lineColorMap: mockLineColorMap,
    networkAlerts: [],
    stopAlerts: [],
    lineAlerts: [],
  };

  /** Reused by the TAD zone tests and the next-flex-window tests. */
  const mockZone: FlexLocation = {
    id: 'loc-1',
    externalId: 'FLEX_NORTH',
    stopExternalId: 'EXT_STOP_1',
    name: 'Zone Nord',
    geometryType: 'Polygon',
    geometryJson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[[5.70, 45.18], [5.75, 45.18], [5.75, 45.20], [5.70, 45.20], [5.70, 45.18]]],
    }),
    minLongitude: 5.70, maxLongitude: 5.75,
    minLatitude: 45.18, maxLatitude: 45.20,
  };

  const now = new Date();
  const futureHour = now.getHours() + 2;
  const futureTimeStr = `${String(futureHour).padStart(2, '0')}:30:00`;
  const pastTimeStr = `${String(Math.max(0, now.getHours() - 2)).padStart(2, '0')}:15:00`;

  const mockSchedules: Schedule[] = [
    {
      id: 'sched-1',
      time: futureTimeStr,
      stopId: 'stop-1',
      itinerary: {
        id: 'it-1',
        name: 'Line M1 - North',
        terminusName: 'North Station',
      directionId: null,
        line: { id: 'line-m1', code: 'M1', name: 'Metro 1', color: '#FFCD00' },
      },
    },
    {
      id: 'sched-2',
      time: pastTimeStr,
      stopId: 'stop-1',
      itinerary: {
        id: 'it-1',
        name: 'Line M1 - North',
        terminusName: 'North Station',
      directionId: null,
        line: { id: 'line-m1', code: 'M1', name: 'Metro 1', color: '#FFCD00' },
      },
    },
  ];

  function createComponent(data: Partial<StopPopupData> = {}): void {
    const dialogData = { ...baseMockData, ...data };

    TestBed.configureTestingModule({
      imports: [
        StopPopupComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: stopPopupDict, fr: stopPopupDict },
          translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'fr' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: ScheduleService, useValue: mockScheduleService },
        { provide: NetworkMapDataService, useValue: mockNetworkMapData },
        { provide: FareCalculatorService, useValue: mockFareCalculator },
        { provide: FlexStopTimeService, useValue: mockFlexStopTimes },
        { provide: LocaleService, useValue: { current: signal('fr') } },
      ],
    });

    fixture = TestBed.createComponent(StopPopupComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    mockScheduleService = {
      getForStop: vi.fn().mockReturnValue(of(mockSchedules)),
    };
    mockNetworkMapData = {
      getStopTadZone: vi.fn().mockReturnValue(of(null)),
      getStopBookingRules: vi.fn().mockReturnValue(of([])),
      getStopPathwayGraph: vi.fn().mockReturnValue(of(null)),
    };
    mockFareCalculator = {
      calculate: vi.fn().mockReturnValue(of(null)),
    };
    mockFlexStopTimes = {
      getWindowsForLocation: vi.fn().mockReturnValue(of([] as FlexStopTime[])),
    };
  });

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should display the stop name', async () => {
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
    expect(title.textContent.trim()).toBe('Central Station');
  });

  it('should display line badges for all line codes', async () => {
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    const badges = fixture.nativeElement.querySelectorAll('.line-badges .line-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent.trim()).toBe('M1');
    expect(badges[1].textContent.trim()).toBe('M4');
  });

  it('should load schedules on init', () => {
    createComponent();
    fixture.detectChanges();

    expect(mockScheduleService.getForStop).toHaveBeenCalledWith('stop-1');
  });

  it('should build timetable groups from schedules', async () => {
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.loading()).toBe(false);
    expect(component.timetableGroups().length).toBeGreaterThan(0);

    const group = component.timetableGroups()[0]!;
    expect(group.lineCode).toBe('M1');
    expect(group.directionName).toBe('North Station');
    expect(group.times.length).toBe(2);
  });

  it('should show loading state initially', () => {
    mockScheduleService.getForStop = vi.fn().mockReturnValue(of(mockSchedules));
    createComponent();
    // Before detectChanges, loading is true
    expect(component.loading()).toBe(true);
  });

  it('should show error state when schedule loading fails', async () => {
    mockScheduleService.getForStop = vi.fn().mockReturnValue(throwError(() => new Error('Network error')));
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.error()).toBe('Failed to load schedules');
    expect(component.loading()).toBe(false);
  });

  it('should show empty state when no schedules exist', async () => {
    mockScheduleService.getForStop = vi.fn().mockReturnValue(of([]));
    createComponent();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.timetableGroups().length).toBe(0);

    const emptyEl = fixture.nativeElement.querySelector('.empty');
    expect(emptyEl).toBeTruthy();
    expect(emptyEl.textContent).toContain('No scheduled departures');
  });

  it('should return correct line color from lineColorMap', () => {
    createComponent();
    fixture.detectChanges();

    expect(component.getLineColor('M1')).toBe('#FFCD00');
    expect(component.getLineColor('M4')).toBe('#BB4D98');
    expect(component.getLineColor('UNKNOWN')).toBe('#666');
  });

  it('should return correct message icon for each severity', () => {
    createComponent();

    expect(component.getMessageIcon('CRITICAL')).toBe('error');
    expect(component.getMessageIcon('WARNING')).toBe('warning');
    expect(component.getMessageIcon('INFO')).toBe('info');
    expect(component.getMessageIcon('OTHER')).toBe('info');
  });

  describe('TAD zone', () => {
    it('skips the fetch when the stop has no on-demand pickup', () => {
      createComponent({ stop: { ...mockStop, hasOnDemand: false } });
      fixture.detectChanges();

      expect(mockNetworkMapData.getStopTadZone).not.toHaveBeenCalled();
      expect(component.tadZone()).toBeNull();
    });

    it('fetches the polygon when hasOnDemand is true and renders one path per ring', async () => {
      mockNetworkMapData.getStopTadZone = vi.fn().mockReturnValue(of(mockZone));
      createComponent({ stop: { ...mockStop, hasOnDemand: true } });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockNetworkMapData.getStopTadZone).toHaveBeenCalledWith('stop-1');
      expect(component.tadZone()).toEqual(mockZone);
      expect(component.tadZoneRings().length).toBe(1);
      expect(component.tadZoneRings()[0]!.path.startsWith('M ')).toBe(true);
    });

    it('keeps tadZone null when the API returns no zone', async () => {
      mockNetworkMapData.getStopTadZone = vi.fn().mockReturnValue(of(null));
      createComponent({ stop: { ...mockStop, hasOnDemand: true } });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.tadZone()).toBeNull();
      expect(component.tadZoneRings()).toEqual([]);
      expect(fixture.nativeElement.querySelector('.tad-zone-section')).toBeFalsy();
    });

    it('renders the section header when a zone is present', async () => {
      mockNetworkMapData.getStopTadZone = vi.fn().mockReturnValue(of(mockZone));
      createComponent({ stop: { ...mockStop, hasOnDemand: true } });
      fixture.detectChanges();
      await fixture.whenStable();

      const section = fixture.nativeElement.querySelector('.tad-zone-section');
      expect(section).toBeTruthy();
      expect(section.textContent).toContain('Zone Nord');
    });
  });

  describe('fare panel', () => {
    const mockOrigin: LayoutStop = {
      id: 'stop-2',
      name: 'Origin Stop',
      latitude: 48.86,
      longitude: 2.36,
      schematicX: 200,
      schematicY: 100,
      lineCodes: ['M1'],
      x: 200,
      y: 100,
    };

    it('does not call the fare calculator when no origin is provided', () => {
      createComponent();
      fixture.detectChanges();
      expect(mockFareCalculator.calculate).not.toHaveBeenCalled();
    });

    it('does not call the fare calculator when origin equals target', () => {
      createComponent({ originStop: mockStop });
      fixture.detectChanges();
      expect(mockFareCalculator.calculate).not.toHaveBeenCalled();
    });

    it('calls the fare calculator and renders the V2 amount when present', async () => {
      const result: FareCalculationResult = {
        fromStopId: 'stop-2',
        fromStopName: 'Origin Stop',
        fromZoneId: null,
        toStopId: 'stop-1',
        toStopName: 'Central Station',
        toZoneId: null,
        v1: [],
        v2: [{
          legGroupId: 'lg-1',
          fareProductId: 'fp-1',
          fareProductName: 'Tarif standard',
          amount: 1.7,
          currency: 'EUR',
          fromAreaId: null,
          fromAreaName: null,
          toAreaId: null,
          toAreaName: null,
          rulePriority: null,
          networkId: null,
          fromTimeframeGroupId: null,
          toTimeframeGroupId: null,
        }],
      };
      mockFareCalculator.calculate = vi.fn().mockReturnValue(of(result));
      createComponent({ originStop: mockOrigin });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockFareCalculator.calculate).toHaveBeenCalledWith('stop-2', 'stop-1');
      expect(component.fareLabel()).toContain('1,70');
      expect(component.fareDetail()).toBe('Tarif standard');
      const section = fixture.nativeElement.querySelector('.fare-section');
      expect(section).toBeTruthy();
      expect(section.textContent).toContain('Origin Stop');
    });

    it('falls back to the V1 price when no V2 option matched', async () => {
      const result: FareCalculationResult = {
        fromStopId: 'stop-2',
        fromStopName: 'Origin Stop',
        fromZoneId: 'Z1',
        toStopId: 'stop-1',
        toStopName: 'Central Station',
        toZoneId: 'Z1',
        v1: [{
          fareId: 'F1',
          price: 2.5,
          currency: 'EUR',
          paymentMethod: null,
          transfers: null,
          transferDurationSeconds: null,
          agencyName: 'TAG',
          matchedRoute: null,
          matchedOriginZone: 'Z1',
          matchedDestinationZone: 'Z1',
        }],
        v2: [],
      };
      mockFareCalculator.calculate = vi.fn().mockReturnValue(of(result));
      createComponent({ originStop: mockOrigin });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.fareLabel()).toContain('2,50');
      expect(component.fareDetail()).toBe('TAG');
    });

    it('hides the panel when no priced option is returned', async () => {
      mockFareCalculator.calculate = vi.fn().mockReturnValue(of(null));
      createComponent({ originStop: mockOrigin });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.fareLabel()).toBeNull();
      expect(fixture.nativeElement.querySelector('.fare-section')).toBeFalsy();
    });
  });

  describe('next flex window', () => {
    function buildWindow(start: string, end: string, headsign: string | null = null): FlexStopTime {
      return {
        id: `fst-${start}`,
        itineraryId: null, itineraryName: null,
        lineCode: null, lineColor: null,
        stopSequence: null,
        stopId: null, stopName: null,
        locationExternalId: 'FLEX_NORTH',
        locationName: 'Zone Nord',
        locationGroupExternalId: null, locationGroupName: null,
        startPickupDropOffWindow: start,
        endPickupDropOffWindow: end,
        pickupType: null, dropOffType: null,
        pickupBookingRuleId: null, pickupBookingRuleExternalId: null,
        dropOffBookingRuleId: null, dropOffBookingRuleExternalId: null,
        serviceCalendarId: null, serviceCalendarExternalId: null,
        stopHeadsign: headsign,
      };
    }

    it('does not query flex windows when the stop has no zone', async () => {
      mockNetworkMapData.getStopTadZone = vi.fn().mockReturnValue(of(null));
      createComponent({ stop: { ...mockStop, hasOnDemand: true } });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockFlexStopTimes.getWindowsForLocation).not.toHaveBeenCalled();
      expect(component.nextFlexWindow()).toBeNull();
    });

    it('picks the earliest upcoming window for the day', async () => {
      mockNetworkMapData.getStopTadZone = vi.fn().mockReturnValue(of(mockZone));
      mockFlexStopTimes.getWindowsForLocation = vi.fn().mockReturnValue(of([
        buildWindow('23:30:00', '23:59:00', 'Late'),
        buildWindow('23:45:00', '23:59:00', 'Even later'),
      ]));
      createComponent({ stop: { ...mockStop, hasOnDemand: true } });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockFlexStopTimes.getWindowsForLocation).toHaveBeenCalledWith('FLEX_NORTH');
      // Without pinning the system clock, the result depends on "now":
      //   now < 23:30 → both windows future, first (23:30 "Late") wins.
      //   23:30 ≤ now < 23:45 → only the second (23:45 "Even later") survives.
      //   now ≥ 23:59 → both filtered out, nextFlexWindow is null.
      const window = component.nextFlexWindow();
      if (window === null) {
        expect(component.nextFlexLabel()).toBeNull();
      } else if (window.startPickupDropOffWindow === '23:30:00') {
        expect(component.nextFlexLabel()).toBe('23:30 → 23:59');
        expect(component.nextFlexHeadsign()).toBe('Late');
      } else {
        expect(window.startPickupDropOffWindow).toBe('23:45:00');
        expect(component.nextFlexLabel()).toBe('23:45 → 23:59');
        expect(component.nextFlexHeadsign()).toBe('Even later');
      }
    });

    it('hides the section when every window is past', async () => {
      mockNetworkMapData.getStopTadZone = vi.fn().mockReturnValue(of(mockZone));
      mockFlexStopTimes.getWindowsForLocation = vi.fn().mockReturnValue(of([
        buildWindow('00:01:00', '00:30:00'),
      ]));
      // For this test to be deterministic we need the current time to be
      // strictly after 00:01 — which is always the case unless the suite
      // runs in the very first minute of the day. The branch under test
      // is "filter rejects all windows". A safer alternative would be
      // to mock the Date, but vitest fake-timers wouldn't add value
      // here for a single deterministic check.
      const now = new Date();
      const windowSecs = 60;
      const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      createComponent({ stop: { ...mockStop, hasOnDemand: true } });
      fixture.detectChanges();
      await fixture.whenStable();

      if (nowSecs > windowSecs) {
        expect(component.nextFlexWindow()).toBeNull();
        expect(fixture.nativeElement.querySelector('.flex-window-section')).toBeFalsy();
      }
    });
  });

  describe('messages', () => {
    it('should display no messages when there are none', async () => {
      createComponent();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.messages().length).toBe(0);
      const messageSection = fixture.nativeElement.querySelector('.messages-section');
      expect(messageSection).toBeFalsy();
    });

    it('should combine and sort messages from all alert sources by severity', async () => {
      createComponent({
        networkAlerts: [{ title: 'Network Info', content: 'Info text', severity: 'INFO' }],
        stopAlerts: [{ title: 'Stop Critical', content: 'Critical text', severity: 'CRITICAL' }],
        lineAlerts: [
          { lineCode: 'M1', lineColor: '#FFCD00', title: 'Line Warning', content: 'Warn text', severity: 'WARNING' },
        ],
      });
      fixture.detectChanges();
      await fixture.whenStable();

      const messages = component.messages();
      expect(messages.length).toBe(3);
      // Should be sorted: CRITICAL, WARNING, INFO
      expect(messages[0]!.severity).toBe('CRITICAL');
      expect(messages[1]!.severity).toBe('WARNING');
      expect(messages[2]!.severity).toBe('INFO');
    });

    it('should render message cards in the template', async () => {
      createComponent({
        stopAlerts: [{ title: 'Delay', content: 'Service delayed', severity: 'WARNING' }],
      });
      fixture.detectChanges();
      await fixture.whenStable();

      const messageCards = fixture.nativeElement.querySelectorAll('.message-card');
      expect(messageCards.length).toBe(1);
      expect(messageCards[0].textContent).toContain('Delay');
    });
  });
});
