import { FlexLocation } from '@shared/models';

/** A single GeoJSON {@code Polygon} or {@code MultiPolygon} flattened into
 *  an array of rings — each ring is a closed sequence of {lat, lon} pairs.
 *  Rings beyond the first in any polygon are interior holes per the
 *  GeoJSON spec; we keep them so the SVG renderer can use the {@code
 *  evenodd} fill rule and the holes show through. */
export interface FlatRing {
  /** Index of the source feature in the input list, useful to colour
   *  rings that belong to the same location consistently. */
  featureIndex: number;
  /** Whether this ring is the first (outer) of its polygon — used to
   *  attach the click target to the outer boundary only. */
  outer: boolean;
  /** [longitude, latitude] pairs in source order. The polygon close
   *  point (last == first) is preserved so the SVG path doesn't need
   *  an explicit Z when round-tripping back to GeoJSON. */
  coords: [number, number][];
}

/** Read-only viewport built from a list of locations, ready to feed an
 *  SVG {@code viewBox} attribute and a coordinate-projection function. */
interface FlexLocationsViewport {
  width: number;
  height: number;
  viewBox: string;
  /** Project a single [lon, lat] point into SVG units inside the viewBox.
   *  Returns null when the input list was empty (no projection possible). */
  project: (lon: number, lat: number) => { x: number; y: number };
}

const VIEW_W = 800;
const VIEW_H = 480;
const MARGIN = 0.08;

/** Walk a {@link FlexLocation}'s GeoJSON geometry into a flat list of
 *  rings. Returns an empty array when the JSON is malformed or the
 *  geometry type is neither {@code Polygon} nor {@code MultiPolygon} —
 *  GTFS-flex only mandates these two but the importer happily accepts
 *  anything well-formed, so we degrade gracefully. */
export function ringsFromLocation(location: FlexLocation, featureIndex: number): FlatRing[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(location.geometryJson);
  } catch {
    return [];
  }
  if (!isObject(parsed)) {return [];}
  const type = location.geometryType;
  const coordinates = (parsed as { coordinates?: unknown }).coordinates;

  if (type === 'Polygon') {
    return ringsFromPolygon(coordinates, featureIndex);
  }
  if (type === 'MultiPolygon') {
    if (!Array.isArray(coordinates)) {return [];}
    return coordinates.flatMap(poly => ringsFromPolygon(poly, featureIndex));
  }
  return [];
}

function ringsFromPolygon(coords: unknown, featureIndex: number): FlatRing[] {
  if (!Array.isArray(coords)) {return [];}
  const rings: FlatRing[] = [];
  const ringList = coords as unknown[];
  for (let i = 0; i < ringList.length; i++) {
    const ring = ringList[i];
    if (!Array.isArray(ring)) {continue;}
    const points: [number, number][] = [];
    for (const pt of ring as unknown[]) {
      if (Array.isArray(pt) && pt.length >= 2 &&
          typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        points.push([pt[0], pt[1]]);
      }
    }
    if (points.length >= 3) {
      rings.push({ featureIndex, outer: i === 0, coords: points });
    }
  }
  return rings;
}

/** Build a viewport that fits the bounding box union of every input
 *  location with an 8 % margin. Same equirectangular projection trick
 *  as the shapes preview — accurate enough at city scale and free of
 *  any external geographic library. */
export function buildViewport(locations: FlexLocation[]): FlexLocationsViewport {
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  for (const loc of locations) {
    if (loc.minLatitude !== null && loc.minLatitude < minLat) {minLat = loc.minLatitude;}
    if (loc.maxLatitude !== null && loc.maxLatitude > maxLat) {maxLat = loc.maxLatitude;}
    if (loc.minLongitude !== null && loc.minLongitude < minLon) {minLon = loc.minLongitude;}
    if (loc.maxLongitude !== null && loc.maxLongitude > maxLon) {maxLon = loc.maxLongitude;}
  }

  // No bounding boxes available — fall back to a unit identity projection
  // so the SVG keeps rendering an empty canvas instead of NaN attributes.
  if (!isFinite(minLat) || !isFinite(maxLat) || !isFinite(minLon) || !isFinite(maxLon)) {
    return {
      width: VIEW_W,
      height: VIEW_H,
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      project: () => ({ x: VIEW_W / 2, y: VIEW_H / 2 }),
    };
  }

  const latRange = (maxLat - minLat) || 1e-6;
  const lonRange = (maxLon - minLon) || 1e-6;
  const latMid = (minLat + maxLat) / 2;
  const lonScale = Math.cos(latMid * Math.PI / 180);
  const adjLonRange = lonRange * lonScale;

  const usableW = VIEW_W * (1 - 2 * MARGIN);
  const usableH = VIEW_H * (1 - 2 * MARGIN);
  const ratio = adjLonRange / latRange;
  const targetRatio = VIEW_W / VIEW_H;

  let scale: number;
  if (ratio > targetRatio) {
    scale = usableW / adjLonRange;
  } else {
    scale = usableH / latRange;
  }

  const usedW = adjLonRange * scale;
  const usedH = latRange * scale;
  const offsetX = (VIEW_W - usedW) / 2;
  const offsetY = (VIEW_H - usedH) / 2;

  return {
    width: VIEW_W,
    height: VIEW_H,
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    project: (lon: number, lat: number) => ({
      x: offsetX + (lon - minLon) * lonScale * scale,
      // SVG y grows downward, lat grows north — flip.
      y: offsetY + (maxLat - lat) * scale,
    }),
  };
}

/** Render a single ring into an SVG path data string. Coordinates are
 *  projected through {@code project} on the way out so the caller stays
 *  unaware of the lat/lon → SVG mapping. */
export function ringToSvgPath(
  ring: FlatRing,
  project: (lon: number, lat: number) => { x: number; y: number },
): string {
  if (ring.coords.length === 0) {return '';}
  let d = '';
  for (let i = 0; i < ring.coords.length; i++) {
    const pt = ring.coords[i];
    if (!pt) {continue;}
    const projected = project(pt[0], pt[1]);
    d += `${i === 0 ? 'M' : 'L'} ${projected.x.toFixed(2)},${projected.y.toFixed(2)} `;
  }
  return `${d}Z`;
}

/** Deterministic HSL hue for the polygon fill, indexed by feature
 *  position so a deterministic input produces a deterministic palette.
 *  Saturation 55 % + lightness 60 % keeps the fills visible against a
 *  light card background while staying readable when several zones
 *  overlap. */
export function colorForFeature(featureIndex: number): string {
  // Golden-angle hue spacing — gives perceptually distinct colours
  // even at 20+ zones without two adjacent indexes looking the same.
  const hue = (featureIndex * 137.508) % 360;
  return `hsl(${hue.toFixed(0)}, 55%, 60%)`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
