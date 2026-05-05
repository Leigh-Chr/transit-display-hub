export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class SvgPanZoom {
  private _zoom = 1;
  private _panX = 0;
  private _panY = 0;
  private dragStart: { x: number; y: number; panX: number; panY: number } | null = null;
  private lastTouchDist = 0;

  // No min/max — the user can zoom in or out as far as they want. We keep a
  // tiny epsilon floor only to avoid division by zero when computing the
  // view-box dimensions.
  private readonly MIN_ZOOM = 1e-3;

  get isDragging(): boolean {
    return this.dragStart !== null;
  }

  get zoom(): number {
    return this._zoom;
  }

  get panX(): number {
    return this._panX;
  }

  get panY(): number {
    return this._panY;
  }

  reset(): void {
    this._zoom = 1;
    this._panX = 0;
    this._panY = 0;
  }

  setState(zoom: number, panX: number, panY: number): void {
    if (!isFinite(zoom) || zoom <= 0) {return;}
    this._zoom = Math.max(this.MIN_ZOOM, zoom);
    this._panX = isFinite(panX) ? panX : 0;
    this._panY = isFinite(panY) ? panY : 0;
  }

  computeViewBox(base: ViewBox): string {
    const w = base.w / this._zoom;
    const h = base.h / this._zoom;
    return `${base.x + this._panX} ${base.y + this._panY} ${w} ${h}`;
  }

  zoomIn(base: ViewBox): void {
    this.applyZoomAt(this._zoom * 1.4, 0.5, 0.5, base);
  }

  zoomOut(base: ViewBox): void {
    this.applyZoomAt(this._zoom / 1.4, 0.5, 0.5, base);
  }

  centerOn(sx: number, sy: number, base: ViewBox): void {
    const targetZoom = Math.max(2, this._zoom);
    const w = base.w / targetZoom;
    const h = base.h / targetZoom;
    this._zoom = targetZoom;
    this._panX = sx - base.x - w / 2;
    this._panY = sy - base.y - h / 2;
  }

  /** Wheel handling follows the Figma/Excalidraw convention:
   *   - plain wheel → pan (deltaY scrolls vertically, deltaX horizontally;
   *     trackpads emit both naturally)
   *   - ctrlKey/metaKey + wheel → zoom centred on the cursor
   *   - browser-synthesised pinch on trackpads also lands here with
   *     ctrlKey:true, so pinch zoom keeps working without extra code.
   *
   *  Returns whether the gesture was a zoom — useful for the caller that
   *  wants to surface a "Ctrl + scroll to zoom" hint on the first plain
   *  scroll. */
  onWheel(event: WheelEvent, svgRect: DOMRect, base: ViewBox): { zoomed: boolean } {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      const mx = (event.clientX - svgRect.left) / svgRect.width;
      const my = (event.clientY - svgRect.top) / svgRect.height;
      this.applyZoomAt(this._zoom * factor, mx, my, base);
      return { zoomed: true };
    }

    this.panByScreenPx(event.deltaX, event.deltaY, base, svgRect);
    return { zoomed: false };
  }

  /** Pan by an arbitrary screen-pixel delta. Used by both wheel pan and
   *  keyboard arrow keys so a 50px keystroke feels the same regardless of
   *  zoom level. Tolerates non-finite deltas (some synthetic wheel events
   *  omit one axis) by treating them as zero. */
  panByScreenPx(dxScreen: number, dyScreen: number, base: ViewBox, svgRect: DOMRect): void {
    if (svgRect.width <= 0 || svgRect.height <= 0) {return;}
    const dx = Number.isFinite(dxScreen) ? dxScreen : 0;
    const dy = Number.isFinite(dyScreen) ? dyScreen : 0;
    const scaleX = (base.w / this._zoom) / svgRect.width;
    const scaleY = (base.h / this._zoom) / svgRect.height;
    this._panX += dx * scaleX;
    this._panY += dy * scaleY;
  }

  onPointerDown(event: MouseEvent): boolean {
    if (event.button !== 0) {return false;}
    this.dragStart = { x: event.clientX, y: event.clientY, panX: this._panX, panY: this._panY };
    return true;
  }

  onPointerMove(event: MouseEvent, svgRect: DOMRect, base: ViewBox): boolean {
    if (!this.dragStart) {return false;}
    const scaleX = (base.w / this._zoom) / svgRect.width;
    const scaleY = (base.h / this._zoom) / svgRect.height;
    this._panX = this.dragStart.panX - (event.clientX - this.dragStart.x) * scaleX;
    this._panY = this.dragStart.panY - (event.clientY - this.dragStart.y) * scaleY;
    return true;
  }

  onPointerUp(): void {
    this.dragStart = null;
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const t = event.touches[0];
      if (t) {
        this.dragStart = { x: t.clientX, y: t.clientY, panX: this._panX, panY: this._panY };
      }
    } else if (event.touches.length === 2) {
      this.dragStart = null;
      this.lastTouchDist = this.getTouchDist(event);
    }
  }

  onTouchMove(event: TouchEvent, svgRect: DOMRect, base: ViewBox): void {
    event.preventDefault();

    if (event.touches.length === 1 && this.dragStart) {
      const t = event.touches[0];
      if (t) {
        const scaleX = (base.w / this._zoom) / svgRect.width;
        const scaleY = (base.h / this._zoom) / svgRect.height;
        this._panX = this.dragStart.panX - (t.clientX - this.dragStart.x) * scaleX;
        this._panY = this.dragStart.panY - (t.clientY - this.dragStart.y) * scaleY;
      }
    } else if (event.touches.length === 2) {
      const dist = this.getTouchDist(event);
      if (this.lastTouchDist > 0) {
        const factor = dist / this.lastTouchDist;
        this.applyZoomAt(this._zoom * factor, 0.5, 0.5, base);
      }
      this.lastTouchDist = dist;
    }
  }

  private applyZoomAt(newZoom: number, anchorX: number, anchorY: number, base: ViewBox): void {
    if (!isFinite(newZoom) || newZoom <= 0) {return;}
    newZoom = Math.max(this.MIN_ZOOM, newZoom);

    const oldW = base.w / this._zoom;
    const oldH = base.h / this._zoom;
    const newW = base.w / newZoom;
    const newH = base.h / newZoom;

    this._panX += (oldW - newW) * anchorX;
    this._panY += (oldH - newH) * anchorY;
    this._zoom = newZoom;
  }

  private getTouchDist(event: TouchEvent): number {
    const a = event.touches[0];
    const b = event.touches[1];
    if (!a || !b) {return 0;}
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
}
