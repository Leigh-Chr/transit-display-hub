import { describe, expect, it } from 'vitest';
import { pageRequestToHttpParams } from './page-request.utils';

describe('pageRequestToHttpParams', () => {
  it('builds params from full request', () => {
    const params = pageRequestToHttpParams({
      page: 0,
      size: 10,
      sortBy: 'name',
      sortDir: 'asc',
      search: 'foo',
    });
    expect(params.get('page')).toBe('0');
    expect(params.get('size')).toBe('10');
    expect(params.get('sortBy')).toBe('name');
    expect(params.get('sortDir')).toBe('asc');
    expect(params.get('search')).toBe('foo');
  });

  it('skips undefined fields', () => {
    const params = pageRequestToHttpParams({ page: 1 });
    expect(params.get('page')).toBe('1');
    expect(params.get('size')).toBeNull();
    expect(params.get('sortBy')).toBeNull();
    expect(params.get('sortDir')).toBeNull();
    expect(params.get('search')).toBeNull();
  });

  it('skips whitespace-only search', () => {
    const params = pageRequestToHttpParams({ search: '   ' });
    expect(params.get('search')).toBeNull();
  });

  it('trims non-empty search', () => {
    const params = pageRequestToHttpParams({ search: '  bus  ' });
    expect(params.get('search')).toBe('bus');
  });

  it('merges extras', () => {
    const params = pageRequestToHttpParams({ page: 0 }, { lineId: 'abc-123', active: true });
    expect(params.get('lineId')).toBe('abc-123');
    expect(params.get('active')).toBe('true');
  });

  it('skips null and undefined extras', () => {
    const params = pageRequestToHttpParams({}, { lineId: null, severity: undefined });
    expect(params.get('lineId')).toBeNull();
    expect(params.get('severity')).toBeNull();
  });

  it('skips empty string extras', () => {
    const params = pageRequestToHttpParams({}, { lineId: '' });
    expect(params.get('lineId')).toBeNull();
  });
});
