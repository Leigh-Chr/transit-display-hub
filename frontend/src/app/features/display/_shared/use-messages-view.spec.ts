import { describe, expect, it } from 'vitest';

import { MessageInfo } from '@shared/models';

import { computeMessagesView } from './use-messages-view';

function msg(severity: MessageInfo['severity'], title = 'T', content = 'C'): MessageInfo {
  return { severity, title, content };
}

describe('computeMessagesView', () => {
  it('splits messages into critical and info buckets', () => {
    const view = computeMessagesView([
      msg('CRITICAL', 'A'),
      msg('INFO', 'B'),
      msg('WARNING', 'C'),
      msg('CRITICAL', 'D'),
    ]);

    expect(view.critical.map((m) => m.title)).toEqual(['A', 'D']);
    expect(view.info.map((m) => m.title)).toEqual(['B', 'C']);
  });

  it('returns the base ticker duration for short info content', () => {
    const view = computeMessagesView([msg('INFO', 'Short', 'msg')]);

    // Base 12s, content well under 50 chars → exactly 12s, floor 10s.
    expect(view.tickerDuration).toBe('12s');
  });

  it('stretches the ticker duration with content length', () => {
    const long = 'x'.repeat(120);
    const view = computeMessagesView([msg('INFO', '', long)]);

    // 12 + floor(120/50) * 2 = 12 + 4 = 16s
    expect(view.tickerDuration).toBe('16s');
  });

  it('returns the alert floor when there is no critical content', () => {
    const view = computeMessagesView([msg('INFO', '', '')]);

    // No critical messages → totalLength=0 → max(12, 15) = 15s.
    expect(view.alertDuration).toBe('15s');
  });

  it('stretches the alert duration faster than the ticker', () => {
    const long = 'x'.repeat(100);
    const view = computeMessagesView([msg('CRITICAL', '', long)]);

    // 15 + floor(100/50) * 3 = 15 + 6 = 21s
    expect(view.alertDuration).toBe('21s');
  });
});
