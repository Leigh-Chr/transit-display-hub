import { MessageSeverity } from '@shared/models';

// Re-exported from the shared utility so the schematic-map module keeps a
// single import surface for its co-located helpers, while every other feature
// (dashboard line-badges, etc.) reaches the same implementation directly.
export { readableTextColor } from '@shared/utils/color.utils';

/** Numeric rank for ordering message severities (CRITICAL > WARNING > INFO). */
export function severityRank(s: MessageSeverity): number {
  switch (s) { case 'INFO': return 0; case 'WARNING': return 1; case 'CRITICAL': return 2; }
}

/** Width (SVG units) of the rounded rectangle that backs a line code badge.
 *  Scales with the code length so 2-digit metro lines and longer regional
 *  codes (e.g. "RER-A") stay padded equally. */
export function lineBadgeWidth(code: string): number {
  return Math.max(64, code.length * 14 + 24);
}

/** Translate transform that lays out hidden-line correspondence badges
 *  underneath a stop, in a 4-column grid centred on the stop's X axis.
 *  The last partial row is also centred so an odd number of badges still
 *  reads as deliberately balanced. */
export function hiddenLineBadgeTransform(index: number, total: number): string {
  const COLS = 4;
  const GAP = 36; // SVG units between hidden-line badges (sized for r=16)
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const colsInRow = row < Math.floor(total / COLS) ? COLS : total % COLS || COLS;
  const x = col * GAP - (colsInRow - 1) * GAP / 2;
  const y = row * GAP;
  return `translate(${x}, ${y})`;
}

/** SVG path data for the small icon shown next to each line name. Paths
 *  are derived from Material Symbols (24x24 viewBox, simplified). */
export function getTransportIconPath(type: string): string {
  switch (type) {
    case 'TRAIN': return 'M12 2C8 2 4 2.5 4 6v9.5c0 1.93 1.57 3.5 3.5 3.5L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
    case 'TRAM': return 'M13 5l.75-1.5H17V2H7v1.5h4.75L11 5C7.82 5.26 5 6.76 5 9v9c0 1.38.81 2.56 2 3.12V22c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h4v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-.88c1.19-.56 2-1.74 2-3.12V9c0-2.24-2.82-3.74-6-4zM7.5 19c-.83 0-1.5-.67-1.5-1.5S6.67 16 7.5 16s1.5.67 1.5 1.5S8.33 19 7.5 19zm3.5-7H7V9h4v3zm2 0V9h4v3h-4zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
    case 'BUS': return 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z';
    case 'METRO': return 'M17.8 2.8C16 2.09 13.86 2 12 2c-1.86 0-4 .09-5.8.8C3.53 3.84 2 6.05 2 8.86V22h20V8.86c0-2.81-1.53-5.02-4.2-6.06zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm3.5-7H6V8h5v3zm2 0V8h5v3h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
    case 'FERRY': return 'M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 8.94V5c0-1.1-.9-2-2-2h-3V1H9v2H6c-1.1 0-2 .9-2 2v3.94l-1.28.4c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 5h12v3.32L12 6.4 6 8.32V5z';
    // Trolleybus: visually identical to a bus on this scale; reusing the BUS
    // glyph keeps the icon set consistent without bespoke artwork.
    case 'TROLLEYBUS': return 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z';
    // Monorail: reuse the METRO glyph; the silhouette differs only in real-world
    // detail that doesn't survive at icon scale.
    case 'MONORAIL': return 'M17.8 2.8C16 2.09 13.86 2 12 2c-1.86 0-4 .09-5.8.8C3.53 3.84 2 6.05 2 8.86V22h20V8.86c0-2.81-1.53-5.02-4.2-6.06zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm3.5-7H6V8h5v3zm2 0V8h5v3h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
    case 'CABLE_CAR': return 'M21 5.5l-7.5 1.5V4h2.5V2H8v2h2.5v3.41L3 9l.5 2L11 9.6V11h-1c-2.21 0-4 1.79-4 4v6h12v-6c0-2.21-1.79-4-4-4h-1V9.2l8.5-1.7-.5-2zM10 13h4c.55 0 1 .45 1 1v1H9v-1c0-.55.45-1 1-1zm-1 6v-2h6v2H9z';
    // Funicular: tram silhouette is the closest standard Material glyph.
    case 'FUNICULAR': return 'M13 5l.75-1.5H17V2H7v1.5h4.75L11 5C7.82 5.26 5 6.76 5 9v9c0 1.38.81 2.56 2 3.12V22c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h4v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-.88c1.19-.56 2-1.74 2-3.12V9c0-2.24-2.82-3.74-6-4zM7.5 19c-.83 0-1.5-.67-1.5-1.5S6.67 16 7.5 16s1.5.67 1.5 1.5S8.33 19 7.5 19zm3.5-7H7V9h4v3zm2 0V9h4v3h-4zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
    case 'OTHER': return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z';
    default: return '';
  }
}
