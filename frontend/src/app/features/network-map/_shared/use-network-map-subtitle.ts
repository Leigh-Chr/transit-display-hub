import { Signal, computed, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '@core/i18n/locale.service';

import type { LayoutStop } from '../services/schematic-layout.service';
import type { RouteResult } from '../services/route-finder.service';

interface SubtitleInputs {
  routeResult: Signal<RouteResult | null>;
  departureStop: Signal<LayoutStop | null>;
  arrivalStop: Signal<LayoutStop | null>;
}

/**
 * Subtitle for the network-map header. Mirrors the routing state in
 * three short sentences:
 *
 *  - active route → "Direct route • N stops" or "M transfers • N stops"
 *  - half-set route (departure picked, arrival pending) → "From <name>"
 *  - otherwise the "click a stop" hint
 *
 * The reactive context includes the active language AND the
 * `translationsLoaded` flag so the computed re-fires on lang switch
 * AND on Transloco bundle hydration (otherwise the first paint
 * captures the bare i18n keys — fixed in v1.25.1).
 */
export function useNetworkMapSubtitle(inputs: SubtitleInputs): Signal<string> {
  const locale = inject(LocaleService);
  const transloco = inject(TranslocoService);

  return computed(() => {
    locale.current();
    locale.translationsLoaded();
    const result = inputs.routeResult();
    if (result) {
      const stops = result.allStopIds.length;
      const stopsLabel = transloco.translate(
        stops === 1 ? 'map.route.stopOne' : 'map.route.stopOther',
        { count: stops },
      );
      if (result.transfers === 0) {
        return transloco.translate('map.subtitle.directRoute', { stops });
      }
      const transfersKey = result.transfers === 1
        ? 'map.subtitle.transferOne'
        : 'map.subtitle.transferOther';
      return transloco.translate(transfersKey, { count: result.transfers })
        + ' — ' + stopsLabel;
    }
    const dep = inputs.departureStop();
    if (dep && !inputs.arrivalStop()) {
      return transloco.translate('map.subtitle.departure', { name: dep.name });
    }
    return transloco.translate('map.subtitle.clickStopHint');
  });
}
