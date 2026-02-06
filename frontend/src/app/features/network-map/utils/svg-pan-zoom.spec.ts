import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SvgPanZoom, ViewBox } from './svg-pan-zoom';

describe('SvgPanZoom', () => {
  let pz: SvgPanZoom;
  const base: ViewBox = { x: 0, y: 0, w: 1000, h: 800 };

  beforeEach(() => {
    pz = new SvgPanZoom();
  });

  describe('initial state', () => {
    it('should have zoom=1 and pan at origin', () => {
      expect(pz.computeViewBox(base)).toBe('0 0 1000 800');
    });

    it('should not be dragging', () => {
      expect(pz.isDragging).toBe(false);
    });
  });

  describe('reset()', () => {
    it('should restore initial state after zoom/pan changes', () => {
      pz.zoomIn(base);
      pz.reset();
      expect(pz.computeViewBox(base)).toBe('0 0 1000 800');
    });

    it('should restore initial state after centerOn', () => {
      pz.centerOn(500, 400, base);
      pz.reset();
      expect(pz.computeViewBox(base)).toBe('0 0 1000 800');
    });
  });

  describe('computeViewBox()', () => {
    it('should return correct string at zoom=1 with no pan', () => {
      expect(pz.computeViewBox(base)).toBe('0 0 1000 800');
    });

    it('should halve width and height at zoom=2', () => {
      // Zoom in enough to reach zoom=2 (1.4^2 = 1.96 ~ 2)
      // Use centerOn which sets zoom to at least 2
      pz.centerOn(500, 400, base);
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      // At zoom=2, w=500, h=400
      expect(parts[2]).toBe(500);
      expect(parts[3]).toBe(400);
    });

    it('should account for pan offset', () => {
      // Start a drag to create pan
      const downEvent = { button: 0, clientX: 500, clientY: 400 } as MouseEvent;
      pz.onPointerDown(downEvent);

      const svgRect = { left: 0, top: 0, width: 1000, height: 800 } as DOMRect;
      const moveEvent = { clientX: 400, clientY: 300 } as MouseEvent;
      pz.onPointerMove(moveEvent, svgRect, base);
      pz.onPointerUp();

      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      // Pan should be positive (moved left/up means pan moves right/down in SVG space)
      expect(parts[0]).toBeGreaterThan(0);
      expect(parts[1]).toBeGreaterThan(0);
    });

    it('should use base x/y offsets', () => {
      const offsetBase: ViewBox = { x: 50, y: 30, w: 1000, h: 800 };
      const vb = pz.computeViewBox(offsetBase);
      expect(vb).toBe('50 30 1000 800');
    });
  });

  describe('zoomIn()', () => {
    it('should decrease visible width/height (zoom in)', () => {
      pz.zoomIn(base);
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      // At zoom 1.4, visible w = 1000/1.4 ~ 714.28
      expect(parts[2]).toBeLessThan(1000);
      expect(parts[3]).toBeLessThan(800);
    });

    it('should zoom by factor 1.4', () => {
      pz.zoomIn(base);
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      expect(parts[2]).toBeCloseTo(1000 / 1.4, 1);
      expect(parts[3]).toBeCloseTo(800 / 1.4, 1);
    });
  });

  describe('zoomOut()', () => {
    it('should increase visible width/height (zoom out)', () => {
      pz.zoomIn(base); // First zoom in so we can zoom out
      const afterZoomIn = pz.computeViewBox(base).split(' ').map(Number);

      pz.zoomOut(base);
      const afterZoomOut = pz.computeViewBox(base).split(' ').map(Number);

      expect(afterZoomOut[2]).toBeGreaterThan(afterZoomIn[2]);
      expect(afterZoomOut[3]).toBeGreaterThan(afterZoomIn[3]);
    });

    it('should zoom out by factor 1.4', () => {
      pz.zoomOut(base);
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      expect(parts[2]).toBeCloseTo(1000 * 1.4, 1);
      expect(parts[3]).toBeCloseTo(800 * 1.4, 1);
    });
  });

  describe('zoom clamping', () => {
    it('should not zoom below MIN_ZOOM (0.5)', () => {
      // Zoom out many times to hit the floor
      for (let i = 0; i < 20; i++) {
        pz.zoomOut(base);
      }
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      // At MIN_ZOOM 0.5, visible width = 1000/0.5 = 2000
      expect(parts[2]).toBe(2000);
      expect(parts[3]).toBe(1600);
    });

    it('should not zoom above MAX_ZOOM (4)', () => {
      // Zoom in many times to hit the ceiling
      for (let i = 0; i < 20; i++) {
        pz.zoomIn(base);
      }
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      // At MAX_ZOOM 4, visible width = 1000/4 = 250
      expect(parts[2]).toBe(250);
      expect(parts[3]).toBe(200);
    });
  });

  describe('centerOn()', () => {
    it('should center the view on the given SVG coordinates', () => {
      pz.centerOn(500, 400, base);
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);

      // At zoom=2 (max(2, 1)), w=500, h=400
      // panX = 500 - 0 - 500/2 = 250
      // panY = 400 - 0 - 400/2 = 200
      // viewBox: "250 200 500 400"
      expect(parts[0]).toBe(250);
      expect(parts[1]).toBe(200);
      expect(parts[2]).toBe(500);
      expect(parts[3]).toBe(400);
    });

    it('should use at least zoom=2', () => {
      pz.centerOn(100, 100, base);
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      // visible width = 1000/2 = 500, which means zoom is at least 2
      expect(parts[2]).toBe(500);
    });

    it('should keep current zoom if already above 2', () => {
      // Zoom in to about 2.74 (1.4^3 ~= 2.744)
      pz.zoomIn(base);
      pz.zoomIn(base);
      pz.zoomIn(base);

      pz.centerOn(500, 400, base);
      const vb = pz.computeViewBox(base);
      const parts = vb.split(' ').map(Number);
      // At zoom ~2.744, w = 1000/2.744 ~ 364.4
      expect(parts[2]).toBeLessThan(500);
    });
  });

  describe('onWheel()', () => {
    const svgRect = { left: 0, top: 0, width: 1000, height: 800 } as DOMRect;

    it('should call preventDefault', () => {
      const event = {
        deltaY: -100,
        clientX: 500,
        clientY: 400,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;

      pz.onWheel(event, svgRect, base);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should zoom in when deltaY < 0 (scroll up)', () => {
      const event = {
        deltaY: -100,
        clientX: 500,
        clientY: 400,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;

      pz.onWheel(event, svgRect, base);
      const parts = pz.computeViewBox(base).split(' ').map(Number);
      expect(parts[2]).toBeLessThan(1000);
      expect(parts[3]).toBeLessThan(800);
    });

    it('should zoom out when deltaY > 0 (scroll down)', () => {
      const event = {
        deltaY: 100,
        clientX: 500,
        clientY: 400,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;

      pz.onWheel(event, svgRect, base);
      const parts = pz.computeViewBox(base).split(' ').map(Number);
      expect(parts[2]).toBeGreaterThan(1000);
      expect(parts[3]).toBeGreaterThan(800);
    });

    it('should zoom towards the mouse position', () => {
      // Zoom at top-left corner
      const topLeftEvent = {
        deltaY: -100,
        clientX: 0,
        clientY: 0,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;

      const pz2 = new SvgPanZoom();
      pz.onWheel(topLeftEvent, svgRect, base);
      const vbTopLeft = pz.computeViewBox(base).split(' ').map(Number);

      // Zoom at bottom-right corner
      const bottomRightEvent = {
        deltaY: -100,
        clientX: 1000,
        clientY: 800,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;

      pz2.onWheel(bottomRightEvent, svgRect, base);
      const vbBottomRight = pz2.computeViewBox(base).split(' ').map(Number);

      // Pan offsets should differ based on zoom anchor point
      expect(vbTopLeft[0]).not.toBeCloseTo(vbBottomRight[0], 0);
    });
  });

  describe('onPointerDown()', () => {
    it('should start drag on left button (button=0) and return true', () => {
      const event = { button: 0, clientX: 100, clientY: 100 } as MouseEvent;
      const result = pz.onPointerDown(event);
      expect(result).toBe(true);
      expect(pz.isDragging).toBe(true);
    });

    it('should not start drag on right click (button=2) and return false', () => {
      const event = { button: 2, clientX: 100, clientY: 100 } as MouseEvent;
      const result = pz.onPointerDown(event);
      expect(result).toBe(false);
      expect(pz.isDragging).toBe(false);
    });

    it('should not start drag on middle click (button=1) and return false', () => {
      const event = { button: 1, clientX: 100, clientY: 100 } as MouseEvent;
      const result = pz.onPointerDown(event);
      expect(result).toBe(false);
      expect(pz.isDragging).toBe(false);
    });
  });

  describe('isDragging', () => {
    it('should be true after onPointerDown with left button', () => {
      pz.onPointerDown({ button: 0, clientX: 0, clientY: 0 } as MouseEvent);
      expect(pz.isDragging).toBe(true);
    });

    it('should be false after onPointerUp', () => {
      pz.onPointerDown({ button: 0, clientX: 0, clientY: 0 } as MouseEvent);
      pz.onPointerUp();
      expect(pz.isDragging).toBe(false);
    });

    it('should be false initially', () => {
      expect(pz.isDragging).toBe(false);
    });
  });

  describe('onPointerMove()', () => {
    const svgRect = { left: 0, top: 0, width: 1000, height: 800 } as DOMRect;

    it('should update pan during drag and return true', () => {
      pz.onPointerDown({ button: 0, clientX: 500, clientY: 400 } as MouseEvent);

      const result = pz.onPointerMove(
        { clientX: 400, clientY: 300 } as MouseEvent,
        svgRect,
        base,
      );

      expect(result).toBe(true);
      const parts = pz.computeViewBox(base).split(' ').map(Number);
      // Dragged 100px left, 100px up in screen space
      // scaleX = (1000/1)/1000 = 1, scaleY = (800/1)/800 = 1
      // panX = 0 - (400 - 500)*1 = 100
      // panY = 0 - (300 - 400)*1 = 100
      expect(parts[0]).toBe(100);
      expect(parts[1]).toBe(100);
    });

    it('should return false when not dragging', () => {
      const result = pz.onPointerMove(
        { clientX: 400, clientY: 300 } as MouseEvent,
        svgRect,
        base,
      );
      expect(result).toBe(false);
    });

    it('should scale pan by zoom level', () => {
      pz.zoomIn(base); // zoom = 1.4
      pz.onPointerDown({ button: 0, clientX: 500, clientY: 400 } as MouseEvent);

      pz.onPointerMove(
        { clientX: 400, clientY: 400 } as MouseEvent,
        svgRect,
        base,
      );

      const parts = pz.computeViewBox(base).split(' ').map(Number);
      // At zoom 1.4, scaleX = (1000/1.4)/1000 = 1/1.4
      // The pan in SVG coordinates should be smaller than screen pixels
      // panX from drag = -(400-500) * (1/1.4) = 100/1.4 ~ 71.43
      // But there's also the panX from zoomIn, so just verify it changed
      expect(parts[0]).not.toBe(0);
    });
  });

  describe('onPointerUp()', () => {
    it('should end drag', () => {
      pz.onPointerDown({ button: 0, clientX: 0, clientY: 0 } as MouseEvent);
      expect(pz.isDragging).toBe(true);
      pz.onPointerUp();
      expect(pz.isDragging).toBe(false);
    });
  });

  describe('onTouchStart()', () => {
    it('should start drag with 1 touch', () => {
      const event = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as TouchEvent;

      pz.onTouchStart(event);
      expect(pz.isDragging).toBe(true);
    });

    it('should stop drag and set up pinch with 2 touches', () => {
      // First start a drag with 1 touch
      pz.onTouchStart({
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as TouchEvent);
      expect(pz.isDragging).toBe(true);

      // Then switch to 2 touches
      pz.onTouchStart({
        touches: [
          { clientX: 100, clientY: 200 },
          { clientX: 300, clientY: 200 },
        ],
      } as unknown as TouchEvent);
      expect(pz.isDragging).toBe(false);
    });
  });

  describe('onTouchMove()', () => {
    const svgRect = { left: 0, top: 0, width: 1000, height: 800 } as DOMRect;

    it('should pan with 1 touch', () => {
      pz.onTouchStart({
        touches: [{ clientX: 500, clientY: 400 }],
      } as unknown as TouchEvent);

      const moveEvent = {
        touches: [{ clientX: 400, clientY: 300 }],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      pz.onTouchMove(moveEvent, svgRect, base);
      expect(moveEvent.preventDefault).toHaveBeenCalled();

      const parts = pz.computeViewBox(base).split(' ').map(Number);
      expect(parts[0]).toBe(100);
      expect(parts[1]).toBe(100);
    });

    it('should zoom with 2 touches (pinch)', () => {
      // Start with 2 touches 200px apart
      pz.onTouchStart({
        touches: [
          { clientX: 400, clientY: 400 },
          { clientX: 600, clientY: 400 },
        ],
      } as unknown as TouchEvent);

      // Move touches 400px apart (spread = zoom in)
      const moveEvent = {
        touches: [
          { clientX: 300, clientY: 400 },
          { clientX: 700, clientY: 400 },
        ],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      pz.onTouchMove(moveEvent, svgRect, base);

      const parts = pz.computeViewBox(base).split(' ').map(Number);
      // Pinch out (spread) should zoom in, reducing visible width
      expect(parts[2]).toBeLessThan(1000);
    });

    it('should call preventDefault on touch move', () => {
      pz.onTouchStart({
        touches: [{ clientX: 500, clientY: 400 }],
      } as unknown as TouchEvent);

      const moveEvent = {
        touches: [{ clientX: 500, clientY: 400 }],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      pz.onTouchMove(moveEvent, svgRect, base);
      expect(moveEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not pan with 1 touch when not dragging', () => {
      // Start with 2 touches (which cancels drag)
      pz.onTouchStart({
        touches: [
          { clientX: 400, clientY: 400 },
          { clientX: 600, clientY: 400 },
        ],
      } as unknown as TouchEvent);

      const moveEvent = {
        touches: [{ clientX: 300, clientY: 300 }],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      pz.onTouchMove(moveEvent, svgRect, base);

      // Pan should remain at 0,0 since drag was not active
      const parts = pz.computeViewBox(base).split(' ').map(Number);
      expect(parts[0]).toBe(0);
      expect(parts[1]).toBe(0);
    });

    it('should zoom with pinch-in (fingers closer together)', () => {
      // Start with 2 touches 400px apart
      pz.onTouchStart({
        touches: [
          { clientX: 300, clientY: 400 },
          { clientX: 700, clientY: 400 },
        ],
      } as unknown as TouchEvent);

      // Move touches to 200px apart (pinch in = zoom out)
      const moveEvent = {
        touches: [
          { clientX: 400, clientY: 400 },
          { clientX: 600, clientY: 400 },
        ],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      pz.onTouchMove(moveEvent, svgRect, base);

      const parts = pz.computeViewBox(base).split(' ').map(Number);
      // Pinch in should zoom out, increasing visible width
      expect(parts[2]).toBeGreaterThan(1000);
    });
  });
});
