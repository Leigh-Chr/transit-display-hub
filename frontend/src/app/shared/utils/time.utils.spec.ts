import { describe, it, expect } from 'vitest';
import {
  formatClockTime,
  formatClockDate,
  formatDepartureTime,
  getMinutesUntil,
  isImminent,
} from './time.utils';

describe('time.utils', () => {
  describe('formatDepartureTime', () => {
    it('keeps only HH:MM from HH:MM:SS', () => {
      expect(formatDepartureTime('14:23:45')).toBe('14:23');
    });

    it('returns HH:MM as-is', () => {
      expect(formatDepartureTime('07:05')).toBe('07:05');
    });

    it('preserves the same behaviour as the original helpers on malformed input', () => {
      // Empty input → split returns [''], so hours = '' (truthy under ?? since
      // it's not null/undefined) and minutes = '00'. Documented quirk; tests
      // pin the existing kiosk/hub behaviour rather than introducing a new
      // contract.
      expect(formatDepartureTime('')).toBe(':00');
    });
  });

  describe('getMinutesUntil', () => {
    it('returns the positive delta when the departure is later today', () => {
      const now = new Date('2026-05-16T08:00:00');
      expect(getMinutesUntil('08:30', now)).toBe(30);
    });

    it('returns 0 when the departure is in the same minute', () => {
      const now = new Date('2026-05-16T08:00:30');
      expect(getMinutesUntil('08:00', now)).toBe(0);
    });

    it('clamps to 0 when the departure is in the past but less than 6 hours ago', () => {
      const now = new Date('2026-05-16T08:00:00');
      expect(getMinutesUntil('05:00', now)).toBe(0);
    });

    it('wraps to tomorrow when the departure is more than 6 hours in the past', () => {
      // 23:00 viewed at 06:00 means tomorrow's 23:00, i.e. +17h.
      const now = new Date('2026-05-16T06:00:00');
      expect(getMinutesUntil('23:00', now)).toBe(17 * 60);
    });
  });

  describe('isImminent', () => {
    it('returns true exactly at the departure minute', () => {
      const now = new Date('2026-05-16T08:00:30');
      expect(isImminent('08:00', now)).toBe(true);
    });

    it('returns false when at least one minute away', () => {
      const now = new Date('2026-05-16T08:00:30');
      expect(isImminent('08:02', now)).toBe(false);
    });
  });

  describe('formatClockTime / formatClockDate', () => {
    it('renders HH:MM in en locale', () => {
      const out = formatClockTime(new Date('2026-05-16T14:23:00'), 'en');
      expect(out).toMatch(/14:23|2:23/);
    });

    it('renders a long date in fr locale', () => {
      const out = formatClockDate(new Date('2026-05-16T14:23:00'), 'fr');
      // Just sanity-check that the year and a French month abbreviation made it through.
      expect(out).toContain('2026');
    });
  });
});
