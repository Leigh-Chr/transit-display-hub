import { ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { KioskComponent } from './kiosk.component';
import { KioskFixture, setupKioskFixture } from './kiosk-spec.helpers';

describe('KioskComponent', () => {
  let component: KioskComponent;
  let fixture: ComponentFixture<KioskComponent>;
  let mockDisplayService: KioskFixture['mockDisplayService'];
  let mockWsService: KioskFixture['mockWsService'];
  let paramsSubject: KioskFixture['paramsSubject'];
  let queryParamsSubject: KioskFixture['queryParamsSubject'];
  let mockDisplayState: KioskFixture['mockDisplayState'];

  // Local clock helper — must stay in sync with the one inside
  // setupKioskFixture() so the arrival timestamps generated below
  // land in the same hour bucket as the fixture's `mockDisplayState`.
  const futureHour = new Date().getHours() + 2;

  beforeEach(() => {
    ({
      component,
      fixture,
      mockDisplayService,
      mockWsService,
      paramsSubject,
      queryParamsSubject,
      mockDisplayState,
    } = setupKioskFixture());
  });

  afterEach(() => {
    fixture.destroy();
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
});
