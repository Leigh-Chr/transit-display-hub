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

  private readonly MIN_ZOOM = 0.5;
  private readonly MAX_ZOOM = 4;

  get isDragging(): boolean {
    return this.dragStart !== null;
  }

  get zoom(): number {
    return this._zoom;
  }

  reset(): void {
    this._zoom = 1;
    this._panX = 0;
    this._panY = 0;
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

  onWheel(event: WheelEvent, svgRect: DOMRect, base: ViewBox): void {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    const mx = (event.clientX - svgRect.left) / svgRect.width;
    const my = (event.clientY - svgRect.top) / svgRect.height;
    this.applyZoomAt(this._zoom * factor, mx, my, base);
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
    newZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, newZoom));

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
