import { TranslocoService } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { speakNextDepartureText } from './kiosk-speech';

function makeTransloco(): TranslocoService {
  return {
    translate: vi.fn((key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}(${JSON.stringify(params)})`;
      }
      return key;
    }),
  } as unknown as TranslocoService;
}

describe('speakNextDepartureText', () => {
  it('returns the noArrivals key when no next is provided', () => {
    expect(speakNextDepartureText(makeTransloco(), undefined)).toBe('kiosk.speak.noArrivals');
  });

  it('uses kiosk.speak.next when realtimeDelaySeconds is null (no realtime)', () => {
    const out = speakNextDepartureText(makeTransloco(), {
      line: { code: 'A' },
      destinationName: 'Lyon',
      scheduledTime: '08:42:00',
      realtimeDelaySeconds: null,
    });
    expect(out).toContain('kiosk.speak.next(');
    expect(out).toContain('"line":"A"');
    expect(out).toContain('"destination":"Lyon"');
  });

  it('uses kiosk.speak.nextOnTime when delay is exactly 0', () => {
    const out = speakNextDepartureText(makeTransloco(), {
      line: { code: 'A' },
      destinationName: 'Lyon',
      scheduledTime: '08:42:00',
      realtimeDelaySeconds: 0,
    });
    expect(out).toContain('kiosk.speak.nextOnTime');
  });

  it('uses kiosk.speak.nextDelayed and rounds minutes when delay > 0', () => {
    const out = speakNextDepartureText(makeTransloco(), {
      line: { code: 'A' },
      destinationName: 'Lyon',
      scheduledTime: '08:42:00',
      realtimeDelaySeconds: 95, // ≈ 2 min rounded
    });
    expect(out).toContain('kiosk.speak.nextDelayed');
    expect(out).toContain('"minutes":2');
  });

  it('uses kiosk.speak.nextEarly and rounds absolute minutes when delay < 0', () => {
    const out = speakNextDepartureText(makeTransloco(), {
      line: { code: 'A' },
      destinationName: 'Lyon',
      scheduledTime: '08:42:00',
      realtimeDelaySeconds: -130, // ≈ 2 min rounded
    });
    expect(out).toContain('kiosk.speak.nextEarly');
    expect(out).toContain('"minutes":2');
  });
});
