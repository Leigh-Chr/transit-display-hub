import { DestroyRef, ElementRef, Signal, afterNextRender, computed, inject, signal } from '@angular/core';

import { NetworkLineRow } from './schematic-geometry';

/** SVG viewBox tuple shared by the host component and its template. */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SchematicViewport {
  /** ViewBox that tightly wraps the visible rows with a margin for labels
   *  and hidden-line correspondence badges. */
  readonly baseViewBox: Signal<ViewBox>;
  /** Live size of the SVG element on screen, kept in sync via a ResizeObserver. */
  readonly svgRect: Signal<{ w: number; h: number }>;
  /** Natural unit-to-pixel ratio at zoom 1 (single-line is wider, multi-line
   *  is taller — this absorbs the difference). */
  readonly baseScale: Signal<number>;
  /** Inverse total scale used to pin icon-sized elements at constant screen
   *  size regardless of the user zoom or the row count. */
  readonly invZoom: Signal<number>;
  /** Rotated-label transform for labels placed above the row. */
  readonly labelTransformUp: Signal<string>;
  /** Rotated-label transform for labels placed below the row. */
  readonly labelTransformDown: Signal<string>;
}

/** Default viewBox used when the network is empty or hosts no laid-out
 *  stops (mid-filter transition). Mirrors the historical fallback the
 *  schematic component carried inline. */
const DEFAULT_VIEW_BOX: ViewBox = { x: 0, y: 0, w: 1000, h: 600 };
/** Horizontal padding on each side of the content (SVG units). */
const SIDE_MARGIN = 80;
/** Vertical padding for rotated stop labels above and below the content.
 *  ≈150 units accommodates the longest French stop name fanned at -45°. */
const VERTICAL_MARGIN = 160;
/** Content occupies ~60% of the viewBox width — extra space on each side
 *  keeps the legend / chip rows from clipping at low zoom. */
const CONTENT_WIDTH_RATIO = 0.6;

/**
 * Encapsulates the SVG viewport math used by the schematic map:
 *
 * - {@link baseViewBox} reframes the diagram every time the visible rows
 *   change so filters don't leave dead space.
 * - {@link svgRect} tracks the on-screen size of the SVG via a
 *   {@code ResizeObserver}, set up after the first render so the icon-scale
 *   formula can compensate for the unit-to-pixel ratio (different in
 *   single-line vs dense multi-line views).
 * - {@link invZoom} derives the inverse total scale used to pin "icon"
 *   elements (stop circles, badges, alert/route markers) at a constant
 *   screen size regardless of the user zoom.
 *
 * Must be called from an Angular injection context — it grabs
 * {@code DestroyRef} and registers an {@code afterNextRender} hook.
 */
export function useSchematicViewport(input: {
  rows: Signal<NetworkLineRow[]>;
  zoomLevel: Signal<number>;
  svgElement: Signal<ElementRef<SVGSVGElement> | undefined>;
}): SchematicViewport {
  const destroyRef = inject(DestroyRef);
  const svgRect = signal<{ w: number; h: number }>({ w: 0, h: 0 });

  const baseViewBox = computed<ViewBox>(() => {
    const rows = input.rows();
    if (rows.length === 0) { return DEFAULT_VIEW_BOX; }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const row of rows) {
      minY = Math.min(minY, row.y);
      maxY = Math.max(maxY, row.y);
      for (const s of row.stops) {
        minX = Math.min(minX, s.x);
        maxX = Math.max(maxX, s.x);
      }
    }

    // The visible rows may carry no stops at all (mid-filter transition,
    // category with empty rows). Without this fallback the min/max
    // sentinels would propagate "Infinity" into the viewBox attribute
    // and the SVG would stop rendering.
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return DEFAULT_VIEW_BOX;
    }

    const contentW = Math.max((maxX - minX) + SIDE_MARGIN * 2, 200);
    const w = contentW / CONTENT_WIDTH_RATIO;
    const extraSide = (w - contentW) / 2;

    const x = minX - SIDE_MARGIN - extraSide;
    const y = minY - VERTICAL_MARGIN;
    const h = Math.max((maxY - minY) + VERTICAL_MARGIN * 2, 200);

    return { x, y, w, h };
  });

  const baseScale = computed(() => {
    const r = svgRect();
    const vb = baseViewBox();
    if (r.w === 0 || r.h === 0 || vb.w === 0 || vb.h === 0) { return 1; }
    return Math.min(r.w / vb.w, r.h / vb.h);
  });

  const invZoom = computed(() => {
    const total = baseScale() * input.zoomLevel();
    return total > 0 ? 1 / total : 1;
  });

  const labelTransformUp = computed(() => `rotate(-45) scale(${invZoom()}) translate(8, -8)`);
  const labelTransformDown = computed(() => `rotate(45) scale(${invZoom()}) translate(8, 8)`);

  afterNextRender(() => {
    const svg = input.svgElement()?.nativeElement;
    if (!svg) { return; }
    const update = (): void => {
      const r = svg.getBoundingClientRect();
      svgRect.set({ w: r.width, h: r.height });
    };
    update();
    if (typeof ResizeObserver === 'undefined') { return; }
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    destroyRef.onDestroy(() => ro.disconnect());
  });

  return {
    baseViewBox,
    svgRect: svgRect.asReadonly(),
    baseScale,
    invZoom,
    labelTransformUp,
    labelTransformDown,
  };
}
