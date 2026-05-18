import { Signal, computed, effect, signal } from '@angular/core';
import { linkedQueryParam } from 'ngxtension/linked-query-param';

import type { SvgPanZoom, ViewBox } from '../../utils/svg-pan-zoom';

export interface PanZoomUrl {
  /** Live "x y w h" string consumed by `<svg [attr.viewBox]>`. */
  readonly currentViewBox: Signal<string>;
  /** Effective zoom factor — 1 at the natural view, 2 zoomed-in 2×. */
  readonly zoomLevel: Signal<number>;
  /** Reads the current pan/zoom state from {@link SvgPanZoom},
   *  recomputes the viewBox and writes ?z / ?p back. Call after every
   *  imperative pan/zoom (zoomIn, zoomOut, onWheel, onPointerMove,
   *  onTouchMove, keyboard). */
  syncFromPanZoom(): void;
  /** Reset the underlying {@link SvgPanZoom} to its natural state and
   *  recompute the viewBox. Used by the layout-change effect and by
   *  user-triggered "reset view" actions. */
  reset(): void;
}

/**
 * Mirrors the schematic-map's pan/zoom state into the URL (?z=&p=)
 * and back. Owns:
 *
 *  - the two {@link linkedQueryParam} for zoom and pan;
 *  - the `currentViewBox` signal consumed by the SVG;
 *  - one effect propagating URL → {@link SvgPanZoom} state (deep links,
 *    browser back/forward);
 *  - one effect that resets the view when the layout signature
 *    changes *and* no explicit URL pin was provided.
 *
 * Must be called from an injection context (the linkedQueryParam +
 * effect calls grab the surrounding injector). The two `linkedQueryParam`
 * factories require an active router context — the schematic-map host
 * is mounted under `RouterOutlet`, so this happens automatically when
 * the composable runs from its constructor.
 */
export function usePanZoomUrl(deps: {
  panZoom: SvgPanZoom;
  baseViewBox: Signal<ViewBox>;
  layoutSignature: Signal<string>;
}): PanZoomUrl {
  const { panZoom, baseViewBox, layoutSignature } = deps;

  const zoomParam = linkedQueryParam('z', {
    parse: (v: string | null): number | null => {
      if (v === null) {return null;}
      const n = parseFloat(v);
      return isFinite(n) && n > 0 ? n : null;
    },
    stringify: (v: number | null) => v === null ? null : v.toFixed(3).replace(/\.?0+$/, ''),
  });

  const panParam = linkedQueryParam('p', {
    parse: (v: string | null): { x: number; y: number } | null => {
      if (v === null) {return null;}
      const parts = v.split(',');
      if (parts.length !== 2) {return null;}
      const x = parseFloat(parts[0] ?? '');
      const y = parseFloat(parts[1] ?? '');
      return isFinite(x) && isFinite(y) ? { x, y } : null;
    },
    stringify: (v: { x: number; y: number } | null) =>
      v === null ? null : `${Math.round(v.x)},${Math.round(v.y)}`,
  });

  const currentViewBox = signal('0 0 800 220');

  const updateViewBox = (): void => {
    currentViewBox.set(panZoom.computeViewBox(baseViewBox()));
  };

  const syncStateToUrl = (): void => {
    const z = panZoom.zoom;
    const px = panZoom.panX;
    const py = panZoom.panY;
    zoomParam.set(Math.abs(z - 1) < 1e-3 ? null : z);
    panParam.set(Math.abs(px) < 0.5 && Math.abs(py) < 0.5 ? null : { x: px, y: py });
  };

  const resetView = (): void => {
    panZoom.reset();
    updateViewBox();
    // Clears ?z and ?p — both fall to null since the reset put the
    // pan/zoom state right at the natural origin.
    syncStateToUrl();
  };

  // 1. URL → state. Re-applies whenever the user navigates with new ?z/?p
  //    values (back/forward, deep link, programmatic). The diff check
  //    breaks the loop with the URL-write side below.
  effect(() => {
    const z = zoomParam();
    const p = panParam();
    const targetZoom = z ?? 1;
    const targetPanX = p?.x ?? 0;
    const targetPanY = p?.y ?? 0;
    if (
      Math.abs(panZoom.zoom - targetZoom) > 1e-3 ||
      Math.abs(panZoom.panX - targetPanX) > 0.5 ||
      Math.abs(panZoom.panY - targetPanY) > 0.5
    ) {
      panZoom.setState(targetZoom, targetPanX, targetPanY);
      currentViewBox.set(panZoom.computeViewBox(baseViewBox()));
    }
  });

  // 2. Layout change → reset view, but only when the URL hasn't pinned
  //    an explicit zoom/pan (e.g. a shared deep-link must survive a
  //    filter-driven layout signature change).
  effect(() => {
    layoutSignature();
    if (zoomParam() === null && panParam() === null) {
      resetView();
    }
  });

  /** Effective zoom level: 1 = base view, 2 = zoomed-in 2x. Drives
   *  level-of-detail decisions in the host. */
  const zoomLevel = computed(() => {
    const parts = currentViewBox().split(' ').map(parseFloat);
    const curW = parts[2];
    const baseW = baseViewBox().w;
    if (!curW || curW <= 0 || !baseW) {return 1;}
    return baseW / curW;
  });

  return {
    currentViewBox: currentViewBox.asReadonly(),
    zoomLevel,
    syncFromPanZoom(): void {
      updateViewBox();
      syncStateToUrl();
    },
    reset: resetView,
  };
}
