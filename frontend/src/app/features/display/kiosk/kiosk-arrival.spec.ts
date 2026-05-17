import { describe, expect, it } from 'vitest';
import { effectiveTime } from './kiosk-arrival';

describe('effectiveTime', () => {
  it('returns the scheduled time when there is no realtime delay', () => {
    expect(effectiveTime({ scheduledTime: '08:42:00' })).toBe('08:42:00');
    expect(effectiveTime({ scheduledTime: '08:42:00', realtimeDelaySeconds: 0 })).toBe('08:42:00');
    expect(effectiveTime({ scheduledTime: '08:42:00', realtimeDelaySeconds: null })).toBe('08:42:00');
  });

  it('adds positive delay seconds', () => {
    expect(effectiveTime({ scheduledTime: '08:42:00', realtimeDelaySeconds: 90 })).toBe('08:43:30');
  });

  it('subtracts early seconds (negative delay)', () => {
    expect(effectiveTime({ scheduledTime: '08:42:00', realtimeDelaySeconds: -120 })).toBe('08:40:00');
  });

  it('wraps past midnight forward', () => {
    expect(effectiveTime({ scheduledTime: '23:58:00', realtimeDelaySeconds: 5 * 60 })).toBe('00:03:00');
  });

  it('wraps past midnight backward', () => {
    expect(effectiveTime({ scheduledTime: '00:02:00', realtimeDelaySeconds: -5 * 60 })).toBe('23:57:00');
  });
});
