import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, throwError } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';

import { ConnectionState } from '@core/websocket/websocket.service';
import { DisplayState } from '@shared/models';

import { KioskComponent } from './kiosk.component';
import { KioskFixture, setupKioskFixture } from './kiosk-spec.helpers';

/**
 * Runtime-side checks for the kiosk: load failure paths, WebSocket
 * propagation, connection state UI, query-param fallback, cleanup.
 * Split from the main spec to stay under the 600-line file-size
 * guardrail. Computed signals, formatters and message separation
 * live in `kiosk.component.spec.ts`.
 */
describe('KioskComponent — runtime behaviour', () => {
  let component: KioskComponent;
  let fixture: ComponentFixture<KioskComponent>;
  let mockDisplayService: KioskFixture['mockDisplayService'];
  let mockWsService: KioskFixture['mockWsService'];
  let paramsSubject: KioskFixture['paramsSubject'];
  let queryParamsSubject: KioskFixture['queryParamsSubject'];
  let mockDisplayState: KioskFixture['mockDisplayState'];

  // Local clock helper — must stay in sync with the one inside
  // setupKioskFixture() so the arrival timestamps it generates land
  // in the same hour bucket as the fixture's `mockDisplayState`.
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
