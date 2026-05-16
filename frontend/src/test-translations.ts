import { TranslocoTestingModule } from '@jsverse/transloco';

/**
 * Build a {@code TranslocoTestingModule} preconfigured with the same
 * dictionary in both English and French. 39 component specs duplicated
 * this same `langs: { en: ..., fr: ... }, translocoConfig: { ... }`
 * boilerplate before this helper landed; using {@code testTranslocoModule(myDict)}
 * keeps the call site to a single import per spec.
 *
 * Passing the same dictionary for both langs is intentional: most
 * component tests only assert that a label renders, not that French
 * and English diverge. Specs that need divergent translations can call
 * {@code testTranslocoModule(en, fr)} with two arguments.
 */
export function testTranslocoModule<T extends object>(
  en: T,
  fr: T = en,
): ReturnType<typeof TranslocoTestingModule.forRoot> {
  return TranslocoTestingModule.forRoot({
    langs: { en, fr },
    translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' },
    preloadLangs: true,
  });
}
