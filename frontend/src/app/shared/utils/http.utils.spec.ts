import { describe, expect, it } from 'vitest';
import { httpErrorMessage } from './http.utils';

describe('httpErrorMessage', () => {
  it('returns the server message when present', () => {
    const err = { error: { message: 'Stop name already taken' } };
    expect(httpErrorMessage(err, 'fallback')).toBe('Stop name already taken');
  });

  it('returns the fallback when error has no message', () => {
    expect(httpErrorMessage({ error: {} }, 'fallback')).toBe('fallback');
    expect(httpErrorMessage({}, 'fallback')).toBe('fallback');
    expect(httpErrorMessage(null, 'fallback')).toBe('fallback');
    expect(httpErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(httpErrorMessage('plain string error', 'fallback')).toBe('fallback');
  });
});
