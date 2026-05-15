import { TestBed, TestModuleMetadata } from '@angular/core/testing';
import { provideZonelessChangeDetection, Provider } from '@angular/core';

// jsdom on CI no longer ships the deprecated MediaQueryList.addListener
// (only its modern addEventListener replacement). Angular CDK's
// BreakpointObserver still calls addListener for back-compat, which makes
// any spec that bootstraps a Material component throw the moment it
// touches matchMedia. Provide a noop polyfill once for every test.
/* eslint-disable @typescript-eslint/no-deprecated --
 * The polyfill below intentionally restores the deprecated
 * MediaQueryList.addListener / removeListener pair so that the
 * Angular CDK BreakpointObserver, which still uses them for
 * back-compat, does not blow up under newer jsdom builds that
 * shipped without them.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query: string): MediaQueryList => {
    const mql = original(query);
    type LegacyMql = MediaQueryList & {
      addListener?: (cb: unknown) => void;
      removeListener?: (cb: unknown) => void;
    };
    const legacy = mql as LegacyMql;
    if (typeof legacy.addListener !== 'function') {
      legacy.addListener = () => undefined;
    }
    if (typeof legacy.removeListener !== 'function') {
      legacy.removeListener = () => undefined;
    }
    return mql;
  };
}
/* eslint-enable @typescript-eslint/no-deprecated */

// Configure TestBed with zoneless change detection for all tests
const originalConfigureTestingModule = TestBed.configureTestingModule.bind(TestBed) as
  (moduleDef: TestModuleMetadata) => typeof TestBed;

TestBed.configureTestingModule = function configureTestingModuleWithZoneless(
  moduleDef: TestModuleMetadata,
): typeof TestBed {
  const providers: Provider[] = (moduleDef.providers ?? []) as Provider[];
  const hasZoneless = providers.some((p: Provider) => {
    if (typeof p === 'object' && 'provide' in p) {
      const provide = (p as { provide: unknown }).provide;
      return typeof provide === 'function' && provide.name.includes('ChangeDetection');
    }
    return false;
  });

  if (!hasZoneless) {
    moduleDef = { ...moduleDef, providers: [provideZonelessChangeDetection(), ...providers] };
  }

  return originalConfigureTestingModule(moduleDef);
};
