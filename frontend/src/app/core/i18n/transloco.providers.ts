import { provideTransloco, TranslocoConfig } from '@jsverse/transloco';
import { EnvironmentProviders, isDevMode } from '@angular/core';
import { HttpTranslocoLoader } from './transloco.loader';

/**
 * Default app i18n setup. Two languages shipped: French (default,
 * historical UI tongue of the project) and English (exposed for
 * touring users at multilingual stations). The runtime switch is
 * driven by {@link LocaleService}; Transloco itself only needs to
 * know the available languages and the loader.
 *
 * Future languages: drop a {@code <code>.json} under
 * {@code src/assets/i18n/} and add the code to {@code availableLangs}
 * — no new provider wiring required.
 */
export const TRANSLOCO_AVAILABLE_LANGS = ['fr', 'en'] as const;

export const translocoConfig: Partial<TranslocoConfig> = {
  availableLangs: [...TRANSLOCO_AVAILABLE_LANGS],
  defaultLang: 'fr',
  fallbackLang: 'fr',
  reRenderOnLangChange: true,
  prodMode: !isDevMode(),
};

export function provideAppTransloco(): EnvironmentProviders[] {
  return provideTransloco({
    config: translocoConfig,
    loader: HttpTranslocoLoader,
  });
}
