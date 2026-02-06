import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportSvgToFile, SvgExportOptions } from './svg-export';
import { ViewBox } from './svg-pan-zoom';

describe('exportSvgToFile', () => {
  const baseViewBox: ViewBox = { x: 10, y: 20, w: 800, h: 600 };

  let mockLink: { href: string; download: string; click: ReturnType<typeof vi.fn> };
  let mockObjectUrl: string;
  let createdBlob: Blob | null;

  function buildSvgElement(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');
    svg.setAttribute('class', 'some-class');

    // Ephemeral elements that should be removed
    const routeActivePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    routeActivePath.classList.add('route-active-path');
    svg.appendChild(routeActivePath);

    const routeArrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    routeArrow.classList.add('route-arrow');
    svg.appendChild(routeArrow);

    const routeMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    routeMarker.classList.add('route-marker');
    svg.appendChild(routeMarker);

    const alertBadge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    alertBadge.classList.add('alert-badge');
    svg.appendChild(alertBadge);

    const searchHighlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    searchHighlight.classList.add('search-highlight-ring');
    svg.appendChild(searchHighlight);

    // A stop-group with a hidden-line badge (last child g with matching transform)
    const stopGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    stopGroup.classList.add('stop-group');
    const stopCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    stopGroup.appendChild(stopCircle);
    const hiddenBadge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hiddenBadge.setAttribute('transform', 'translate(0, 18)');
    stopGroup.appendChild(hiddenBadge);
    svg.appendChild(stopGroup);

    // Element with route-dimmed class
    const dimmedPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    dimmedPath.classList.add('route-dimmed');
    svg.appendChild(dimmedPath);

    // Element with route-active and route-transfer classes
    const activePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    activePath.classList.add('route-active', 'route-transfer');
    svg.appendChild(activePath);

    // A regular element that should survive
    const regularCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    regularCircle.setAttribute('id', 'keep-me');
    svg.appendChild(regularCircle);

    return svg;
  }

  beforeEach(() => {
    createdBlob = null;
    mockObjectUrl = 'blob:http://localhost/fake-uuid';

    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return mockLink as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node);

    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      createdBlob = obj as Blob;
      return mockObjectUrl;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function callExport(overrides: Partial<SvgExportOptions> = {}): void {
    const defaults: SvgExportOptions = {
      svgElement: buildSvgElement(),
      baseViewBox,
      visibleLineCodes: ['L1', 'L2', 'L3'],
      allLineCodes: ['L1', 'L2', 'L3'],
    };
    exportSvgToFile({ ...defaults, ...overrides });
  }

  describe('viewBox and dimensions', () => {
    it('should set viewBox from baseViewBox', () => {
      const svg = buildSvgElement();
      const clone = svg.cloneNode(true) as SVGSVGElement;

      // We verify through the serialized output by checking the blob content
      callExport({ svgElement: svg });

      expect(createdBlob).not.toBeNull();
      // Read blob content to verify attributes
      const reader = new FileReader();
      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).toContain('viewBox="10 20 800 600"');
          expect(content).toContain('width="800"');
          expect(content).toContain('height="600"');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should remove the class attribute from the cloned SVG', () => {
      const svg = buildSvgElement();
      callExport({ svgElement: svg });

      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          // The root SVG element should not have class="some-class"
          expect(content).not.toContain('class="some-class"');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });
  });

  describe('ephemeral element removal', () => {
    it('should remove .route-active-path elements', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('route-active-path');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should remove .route-arrow elements', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('route-arrow');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should remove .route-marker elements', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('route-marker');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should remove .alert-badge elements', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('alert-badge');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should remove .search-highlight-ring elements', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('search-highlight-ring');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should keep regular elements that are not ephemeral', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).toContain('keep-me');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });
  });

  describe('hidden-line badge removal', () => {
    it('should remove stop-group last-child g with translate(0, 18) transform', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('translate(0, 18)');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should remove stop-group last-child g with translate(0, 28) transform', () => {
      const svg = buildSvgElement();
      // Replace the hidden badge transform with the other matching pattern
      const stopGroup = svg.querySelector('.stop-group')!;
      const lastChild = stopGroup.querySelector('g:last-child')!;
      lastChild.setAttribute('transform', 'translate(0, 28)');

      callExport({ svgElement: svg });
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('translate(0, 28)');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should keep g elements that do not match the hidden-line badge pattern', () => {
      const svg = buildSvgElement();
      const stopGroup = svg.querySelector('.stop-group')!;
      const lastChild = stopGroup.querySelector('g:last-child')!;
      lastChild.setAttribute('transform', 'translate(10, 10)');

      callExport({ svgElement: svg });
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).toContain('translate(10, 10)');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });
  });

  describe('CSS class stripping', () => {
    it('should strip route-dimmed class', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('route-dimmed');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should strip stop-group class', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('stop-group');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should strip route-active class', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('route-active');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should strip route-transfer class', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).not.toContain('route-transfer');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });
  });

  describe('inline style injection', () => {
    it('should inject a style element with .stop-name rules', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).toContain('<style');
          expect(content).toContain('.stop-name');
          expect(content).toContain('font-size: 12px');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should inject styles for interchange-connector', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).toContain('.interchange-connector');
          expect(content).toContain('stroke-dasharray: 4 4');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should inject styles for line-badge-text', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          expect(content).toContain('.line-badge-text');
          expect(content).toContain('fill: white');
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });

    it('should insert the style element before other content', () => {
      callExport();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          const styleIndex = content.indexOf('<style');
          const circleIndex = content.indexOf('id="keep-me"');
          expect(styleIndex).toBeLessThan(circleIndex);
          resolve();
        };
        reader.readAsText(createdBlob!);
      });
    });
  });

  describe('filename generation', () => {
    it('should use "network-map" prefix when all line codes are visible', () => {
      callExport({
        visibleLineCodes: ['L1', 'L2', 'L3'],
        allLineCodes: ['L1', 'L2', 'L3'],
      });

      expect(mockLink.download).toMatch(/^network-map_/);
    });

    it('should use joined codes prefix when a subset of lines is visible', () => {
      callExport({
        visibleLineCodes: ['L1', 'L3'],
        allLineCodes: ['L1', 'L2', 'L3'],
      });

      expect(mockLink.download).toMatch(/^L1-L3-map_/);
    });

    it('should use a single code prefix when only one line is visible', () => {
      callExport({
        visibleLineCodes: ['L2'],
        allLineCodes: ['L1', 'L2', 'L3'],
      });

      expect(mockLink.download).toMatch(/^L2-map_/);
    });

    it('should include a timestamp in YYYY-MM-DD_HHhMM format', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 2, 15, 14, 7)); // March 15, 2025 14:07

      callExport();

      expect(mockLink.download).toContain('2025-03-15_14h07');

      vi.useRealTimers();
    });

    it('should end with .svg extension', () => {
      callExport();
      expect(mockLink.download).toMatch(/\.svg$/);
    });
  });

  describe('blob creation', () => {
    it('should create a Blob with image/svg+xml content type', () => {
      callExport();

      expect(createdBlob).not.toBeNull();
      expect(createdBlob!.type).toBe('image/svg+xml;charset=utf-8');
    });

    it('should pass the serialized SVG string to the Blob', () => {
      callExport();

      expect(createdBlob).not.toBeNull();
      expect(createdBlob!.size).toBeGreaterThan(0);
    });
  });

  describe('download trigger', () => {
    it('should create an object URL from the blob', () => {
      callExport();

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    it('should set the link href to the object URL', () => {
      callExport();

      expect(mockLink.href).toBe(mockObjectUrl);
    });

    it('should set the link download attribute to the filename', () => {
      callExport();

      expect(mockLink.download).toBeTruthy();
      expect(mockLink.download).toMatch(/\.svg$/);
    });

    it('should click the link to trigger the download', () => {
      callExport();

      expect(mockLink.click).toHaveBeenCalledTimes(1);
    });

    it('should append the link to document.body before clicking', () => {
      callExport();

      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
    });
  });

  describe('cleanup', () => {
    it('should remove the link from document.body after clicking', () => {
      callExport();

      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('should revoke the object URL after download', () => {
      callExport();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
    });

    it('should call removeChild before revokeObjectURL', () => {
      const callOrder: string[] = [];
      (document.body.removeChild as ReturnType<typeof vi.fn>).mockImplementation((node: Node) => {
        callOrder.push('removeChild');
        return node;
      });
      (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('revokeObjectURL');
      });

      callExport();

      expect(callOrder).toEqual(['removeChild', 'revokeObjectURL']);
    });
  });

  describe('source SVG is not mutated', () => {
    it('should not modify the original SVG element', () => {
      const svg = buildSvgElement();
      const originalViewBox = svg.getAttribute('viewBox');
      const originalClass = svg.getAttribute('class');
      const originalChildCount = svg.childNodes.length;

      callExport({ svgElement: svg });

      expect(svg.getAttribute('viewBox')).toBe(originalViewBox);
      expect(svg.getAttribute('class')).toBe(originalClass);
      expect(svg.childNodes.length).toBe(originalChildCount);
    });
  });
});
