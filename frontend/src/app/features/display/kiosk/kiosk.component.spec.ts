import { TestBed, ComponentFixture } from '@angular/core/testing';
import { KioskComponent } from './kiosk.component';
import { DisplayService } from '@core/api/display.service';
import { WebSocketService, ConnectionState } from '@core/websocket/websocket.service';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, Subject, EMPTY, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DisplayState } from '@shared/models';

describe('KioskComponent', () => {
  let component: KioskComponent;
  let fixture: ComponentFixture<KioskComponent>;
  let mockDisplayService: { getState: ReturnType<typeof vi.fn>; getStateByToken: ReturnType<typeof vi.fn> };
  let mockWsService: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; connectionState: ReturnType<typeof signal<ConnectionState>> };
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

    mockDisplayService = {
      getState: vi.fn().mockReturnValue(of(mockDisplayState)),
      getStateByToken: vi.fn().mockReturnValue(of(mockDisplayState))
    };

    mockWsService = {
      connect: vi.fn().mockReturnValue(EMPTY),
      disconnect: vi.fn(),
      connectionState: signal<ConnectionState>('CONNECTED')
    };

    TestBed.configureTestingModule({
      imports: [KioskComponent],
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

      expect(mockWsService.connect).toHaveBeenCalledWith('stop-123');
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
      // Default has 2 arrivals → 2*3=6 → Math.max(10,6)=10
      expect(component.scrollDuration()).toBe('10s');
    });

    it('should compute scrollDuration proportional to many arrivals', () => {
      const manyArrivals = Array.from({ length: 8 }, (_, i) => ({
        scheduledTime: `${String(futureHour).padStart(2, '0')}:${String(i + 10).padStart(2, '0')}:00`,
        destinationName: `Station ${i}`,
        line: { id: 'line-1', code: 'L1', name: 'Metro Line 1', color: '#FF5733' }
      }));
      component.displayState.set({ ...mockDisplayState, arrivals: manyArrivals });
      // 8*3=24 → "24s"
      expect(component.scrollDuration()).toBe('24s');
    });

    it('should compute tickerDuration based on info message length', () => {
      // Default: 1 info message "Info Notice" (11 chars title) + "Normal service" (14 chars content) = 25 chars
      // Math.max(15, 20 + Math.floor(25/50)*2) = Math.max(15, 20+0) = 20
      expect(component.tickerDuration()).toBe('20s');
    });

    it('should compute tickerDuration with longer messages', () => {
      component.displayState.set({
        ...mockDisplayState,
        messages: [
          { title: 'A'.repeat(30), content: 'B'.repeat(70), severity: 'INFO' },
          { title: 'C'.repeat(20), content: 'D'.repeat(30), severity: 'WARNING' }
        ]
      });
      // Total length: 30+70+20+30 = 150, floor(150/50)*2 = 6, max(15, 20+6) = 26
      expect(component.tickerDuration()).toBe('26s');
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
    beforeEach(() => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    it('should return minutes for future time', () => {
      const result = component.formatRelativeTime(futureTime);
      // Should contain "min" for future departures
      expect(result).toContain('min');
    });

    it('should return Imminent for current time (0 minutes)', () => {
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
      const result = component.formatRelativeTime(currentTime);
      expect(result).toBe('Imminent');
    });

    it('should return "1 min" for exactly 1 minute in the future', () => {
      const oneMinLater = new Date(now.getTime() + 60000);
      const time = `${String(oneMinLater.getHours()).padStart(2, '0')}:${String(oneMinLater.getMinutes()).padStart(2, '0')}:00`;
      const result = component.formatRelativeTime(time);
      // Should be "1 min" (getMinutesUntil returns 1 for exactly 1 minute ahead)
      expect(result).toBe('1 min');
    });

    it('should return "N min" for N minutes in the future', () => {
      const result = component.formatRelativeTime(futureTime);
      const expectedMinutes = component.getMinutesUntil(futureTime);
      expect(result).toBe(`${expectedMinutes} min`);
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
    beforeEach(() => {
      fixture.detectChanges();
      paramsSubject.next({ stopId: 'stop-123' });
      queryParamsSubject.next({});
    });

    it('should return correct minute difference for future time', () => {
      const result = component.getMinutesUntil(futureTime);
      // futureTime is now.getHours() + 2, at :30
      const expectedHours = futureHour;
      const expectedMinutes = expectedHours * 60 + 30;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      expect(result).toBe(Math.max(0, expectedMinutes - nowMinutes));
    });

    it('should return 0 for current time', () => {
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
      expect(component.getMinutesUntil(currentTime)).toBe(0);
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
