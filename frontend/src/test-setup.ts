import { TestBed, TestModuleMetadata } from '@angular/core/testing';
import { provideZonelessChangeDetection, Provider } from '@angular/core';

// jsdom on CI no longer ships the deprecated MediaQueryList.addListener
// (only its modern addEventListener replacement). Angular CDK's
// BreakpointObserver still calls addListener for back-compat, which makes
// any spec that bootstraps a Material component throw the moment it
// touches matchMedia. Provide a noop polyfill once for every test.
/* eslint-disable @typescript-eslint/no-deprecated --
 * The polyfill below intentionally exposes the deprecated
 * MediaQueryList.addListener / removeListener pair so that the
 * Angular CDK BreakpointObserver, which still uses them for
 * back-compat, does not blow up under jsdom (which dropped them)
 * nor in environments where matchMedia is missing entirely.
 */
if (typeof window !== 'undefined') {
  type LegacyMql = MediaQueryList & {
    addListener?: (cb: unknown) => void;
    removeListener?: (cb: unknown) => void;
  };

  const buildMql = (query: string): MediaQueryList => {
    const listeners = new Set<EventListener>();
    const stub: LegacyMql = {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: ((_t: string, cb: EventListener) => {
        listeners.add(cb);
      }) as MediaQueryList['addEventListener'],
      removeEventListener: ((_t: string, cb: EventListener) => {
        listeners.delete(cb);
      }) as MediaQueryList['removeEventListener'],
      dispatchEvent: (event: Event) => {
        listeners.forEach((cb) => cb(event));
        return true;
      },
    };
    return stub;
  };

  // defineProperty (not plain assignment) so a previous spec that froze
  // window.matchMedia via Object.defineProperty without writable:true
  // does not prevent the polyfill from being reinstalled on the next
  // worker re-init.
  const installMatchMedia = (impl: (query: string) => MediaQueryList): void => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: impl,
    });
  };

  if (typeof window.matchMedia !== 'function') {
    installMatchMedia(buildMql);
  } else {
    const original = window.matchMedia.bind(window);
    installMatchMedia((query: string): MediaQueryList => {
      const mql = original(query) as unknown as LegacyMql;
      if (typeof mql.addListener !== 'function') {
        mql.addListener = () => undefined;
      }
      if (typeof mql.removeListener !== 'function') {
        mql.removeListener = () => undefined;
      }
      return mql;
    });
  }
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
