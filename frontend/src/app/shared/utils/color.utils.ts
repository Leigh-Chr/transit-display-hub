/** Mid-grey we paint a line in when its row carries no color at all
 *  (legacy data, fixture with the color stripped). Picked once so the
 *  three consumers — schematic, stop-popup, network map — can't drift
 *  to different mid-greys over time. */
export const LINE_COLOR_FALLBACK = '#666';

/** Pick a foreground that stays legible on top of {bgHex}. Uses the YIQ
 *  perceived-luminance formula so light brand colors (RATP yellow,
 *  pastel pinks, lime greens) get black text and dark ones keep white.
 *  Threshold biased toward black to keep mid-range colors readable.
 *
 *  Used wherever a user-picked color (line palette) is rendered behind text
 *  (line badges, filter chips, route overlays). */
export function readableTextColor(bgHex: string): string {
  if (!bgHex) {return '#fff';}
  const raw = bgHex.startsWith('#') ? bgHex.slice(1) : bgHex;
  const expanded = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  if (expanded.length !== 6) {return '#fff';}
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  if ([r, g, b].some(c => Number.isNaN(c))) {return '#fff';}
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#1a1a1a' : '#fff';
}

/** Resolve the foreground color for a line. Trusts the server-resolved
 *  {@code textColor} (set at GTFS import or admin save — see
 *  {@code ColorContrast.readableTextColor}). Falls back to white only for
 *  the rare row a test fixture builds by hand without going through the
 *  service layer; production rows always carry it.
 *
 *  Accepts the structural shape `{color, textColor?}` rather than a full
 *  Line so it works equally with `LineInfo`, `NetworkLine` and the admin
 *  `Line` DTOs without coupling to any of them. */
export function lineTextColor(line: { color: string; textColor?: string | null }): string {
  return line.textColor ?? '#fff';
}
