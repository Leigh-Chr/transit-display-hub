import { describe, expect, it } from 'vitest';
import { bcp47, formatLocaleDate } from './locale-date.utils';

describe('bcp47', () => {
  it('maps fr → fr-FR', () => {
    expect(bcp47('fr')).toBe('fr-FR');
  });

  it('maps en → en-US', () => {
    expect(bcp47('en')).toBe('en-US');
  });

  it('passes through full BCP-47 tags unchanged', () => {
    expect(bcp47('fr-CA')).toBe('fr-CA');
  });
});

describe('formatLocaleDate', () => {
  // 2026-05-10 is a Sunday / dimanche
  const ref = new Date('2026-05-10T14:30:00Z');

  it('formats in French', () => {
    const out = formatLocaleDate(ref, 'fr', { weekday: 'long', day: 'numeric', month: 'long' });
    expect(out.toLowerCase()).toMatch(/dimanche|mai/);
  });

  it('formats in English', () => {
    const out = formatLocaleDate(ref, 'en', { weekday: 'long', day: 'numeric', month: 'long' });
    expect(out.toLowerCase()).toMatch(/sunday|may/);
  });

  it('caches formatters across calls (deterministic output)', () => {
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    const a = formatLocaleDate(ref, 'fr', opts);
    const b = formatLocaleDate(ref, 'fr', opts);
    expect(a).toBe(b);
  });
});
