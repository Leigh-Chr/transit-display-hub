import { ViewBox } from './svg-pan-zoom';

export interface SvgExportOptions {
  svgElement: SVGSVGElement;
  baseViewBox: ViewBox;
  visibleLineCodes: string[];
  allLineCodes: string[];
}

export function exportSvgToFile(options: SvgExportOptions): void {
  const { svgElement, baseViewBox: base, visibleLineCodes: codes, allLineCodes: all } = options;

  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Reset viewBox to the full base view (not the zoomed/panned state)
  clone.setAttribute('viewBox', `${base.x} ${base.y} ${base.w} ${base.h}`);
  clone.setAttribute('width', String(base.w));
  clone.setAttribute('height', String(base.h));
  clone.removeAttribute('class');

  // Remove ephemeral UI elements that don't belong in a static export
  const removeSelectors = [
    '.route-active-path',
    '.route-arrow',
    '.route-marker',
    '.alert-badge',
    '.search-highlight-ring',
  ];
  for (const sel of removeSelectors) {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  }

  // Remove hidden-line correspondence clusters: an export shows the network
  // as it stands, not the "what would be there if we re-enabled these lines"
  // hint that only makes sense in the interactive view.
  clone.querySelectorAll('.hidden-lines-cluster').forEach(g => g.remove());

  // Strip route-dimmed class so all elements render at full opacity
  clone.querySelectorAll('.route-dimmed').forEach(el => {
    el.classList.remove('route-dimmed');
  });

  // Strip interactive classes that have no meaning in a static SVG
  clone.querySelectorAll('.stop-group').forEach(el => {
    el.classList.remove('stop-group');
  });
  clone.querySelectorAll('.route-active, .route-transfer').forEach(el => {
    el.classList.remove('route-active', 'route-transfer');
  });

  // Inject inline styles for standalone rendering in external viewers
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    .stop-name {
      font-size: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      fill: #333;
      paint-order: stroke;
      stroke: white;
      stroke-width: 3px;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .network-stop-name { font-size: 10px; }
    .stop-name.interchange { font-weight: 700; font-size: 13px; }
    .stop-name.terminus { font-weight: 700; font-size: 13px; }
    .network-stop-name.interchange { font-size: 11px; }
    .network-stop-name.terminus { font-size: 11px; }
    .interchange-connector {
      stroke: rgba(150, 150, 150, 0.25);
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
    }
    .line-badge-text {
      font-size: 10px;
      font-weight: 700;
      fill: white;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .line-name-label {
      font-size: 9px;
      font-weight: 500;
      fill: #888;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .line-type-icon path {
      fill: #999;
    }
    .network-line-path { opacity: 0.85; }
    .stop-circle {
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
    }
    .line-badge-bg {
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
    }
  `;
  clone.insertBefore(styleEl, clone.firstChild);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });

  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
  const prefix = codes.length === all.length
    ? 'network-map'
    : codes.join('-') + '-map';
  const filename = `${prefix}_${ts}.svg`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
