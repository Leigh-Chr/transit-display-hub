import { describe, it, expect } from 'vitest';
import {
  getTransportIconPath,
  hiddenLineBadgeTransform,
  lineBadgeWidth,
  readableTextColor,
  severityRank,
} from './schematic-map.utils';

describe('schematic-map.utils', () => {
  describe('severityRank', () => {
    it('orders INFO < WARNING < CRITICAL', () => {
      expect(severityRank('INFO')).toBeLessThan(severityRank('WARNING'));
      expect(severityRank('WARNING')).toBeLessThan(severityRank('CRITICAL'));
    });
  });

  describe('readableTextColor', () => {
    it('returns dark text on bright brand colors', () => {
      expect(readableTextColor('#FFEB00')).toBe('#1a1a1a');
      expect(readableTextColor('#FFFFFF')).toBe('#1a1a1a');
    });

    it('returns white text on dark brand colors', () => {
      expect(readableTextColor('#0078D4')).toBe('#fff');
      expect(readableTextColor('#000000')).toBe('#fff');
    });

    it('expands the 3-character shorthand', () => {
      expect(readableTextColor('#fff')).toBe('#1a1a1a');
      expect(readableTextColor('#000')).toBe('#fff');
    });

    it('falls back to white for malformed input', () => {
      expect(readableTextColor('')).toBe('#fff');
      expect(readableTextColor('not-a-color')).toBe('#fff');
      expect(readableTextColor('#zzz')).toBe('#fff');
    });
  });

  describe('lineBadgeWidth', () => {
    it('floors to 64 SVG units for short codes', () => {
      expect(lineBadgeWidth('1')).toBe(64);
      expect(lineBadgeWidth('A')).toBe(64);
    });

    it('grows linearly for longer codes', () => {
      expect(lineBadgeWidth('RER-A')).toBeGreaterThan(64);
      expect(lineBadgeWidth('REGIONAL-LONG')).toBeGreaterThan(lineBadgeWidth('RER-A'));
    });
  });

  describe('hiddenLineBadgeTransform', () => {
    it('places the first badge centred on x = 0 when alone', () => {
      expect(hiddenLineBadgeTransform(0, 1)).toBe('translate(0, 0)');
    });

    it('lays four badges symmetrically around x = 0', () => {
      const positions = [0, 1, 2, 3].map(i => hiddenLineBadgeTransform(i, 4));
      expect(positions).toEqual([
        'translate(-54, 0)',
        'translate(-18, 0)',
        'translate(18, 0)',
        'translate(54, 0)',
      ]);
    });

    it('wraps to a second row after the fourth badge', () => {
      const fifth = hiddenLineBadgeTransform(4, 5);
      expect(fifth).toBe('translate(0, 36)');
    });
  });

  describe('getTransportIconPath', () => {
    it('returns a path for each known type', () => {
      for (const type of ['TRAIN', 'TRAM', 'BUS', 'METRO']) {
        expect(getTransportIconPath(type)).toMatch(/^M/);
      }
    });

    it('returns an empty string for unknown types', () => {
      expect(getTransportIconPath('SPACESHIP')).toBe('');
      expect(getTransportIconPath('')).toBe('');
    });
  });
});
