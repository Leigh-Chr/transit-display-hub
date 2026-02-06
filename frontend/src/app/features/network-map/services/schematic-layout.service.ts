import { Injectable } from '@angular/core';
import { NetworkStop, NetworkLine, NetworkBounds } from '@shared/models';

export interface LayoutStop extends NetworkStop {
  x: number;
  y: number;
}

export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

@Injectable({
  providedIn: 'root'
})
export class SchematicLayoutService {
  private static readonly CANVAS_SIZE = 1000;
  private static readonly PADDING = 80;

  calculateLayout(
    stops: NetworkStop[],
    bounds: NetworkBounds,
    lines?: NetworkLine[]
  ): { stops: LayoutStop[]; bounds: LayoutBounds } {
    if (stops.length === 0) {
      return {
        stops: [],
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 }
      };
    }

    // Check if we have any real coordinates
    const hasCoordinates = stops.some(s =>
      (s.schematicX !== null && s.schematicY !== null) ||
      (s.latitude !== null && s.longitude !== null)
    );

    let layoutStops: LayoutStop[];

    if (hasCoordinates) {
      // Use real coordinates
      const dataBounds = this.calculateDataBounds(stops);
      layoutStops = stops.map(stop => this.calculateStopPositionFromCoords(stop, dataBounds));
    } else if (lines && lines.length > 0) {
      // Generate schematic layout from line topology
      layoutStops = this.generateSchematicLayout(stops, lines);
    } else {
      // Fallback: arrange in a grid
      layoutStops = this.arrangeInGrid(stops);
    }

    return {
      stops: layoutStops,
      bounds: this.calculateLayoutBounds()
    };
  }

  /**
   * Horizontal stacking layout: each line runs left-to-right on its own row.
   * Interchange stops keep the X position assigned by the first line,
   * so subsequent lines bend toward those shared points.
   */
  private generateSchematicLayout(stops: NetworkStop[], lines: NetworkLine[]): LayoutStop[] {
    const stopPositions = new Map<string, { x: number; y: number }>();
    const padding = SchematicLayoutService.PADDING;
    const size = SchematicLayoutService.CANVAS_SIZE - 2 * padding;

    // Row spacing: distribute lines vertically
    const rowSpacing = lines.length > 1 ? size / (lines.length - 1) : 0;
    const baseY = lines.length > 1 ? padding : padding + size / 2;

    // First pass: assign positions. Interchanges keep their first placement.
    lines.forEach((line, lineIndex) => {
      if (line.itineraries.length === 0) return;

      const itinerary = line.itineraries[0];
      const stopCount = itinerary.length;
      if (stopCount === 0) return;

      const y = baseY + lineIndex * rowSpacing;
      const xSpacing = stopCount > 1 ? size / (stopCount - 1) : 0;

      itinerary.forEach((stopId, idx) => {
        if (stopPositions.has(stopId)) {
          return; // interchange: keep existing position
        }

        const x = padding + (stopCount > 1 ? idx * xSpacing : size / 2);
        stopPositions.set(stopId, { x, y });
      });
    });

    const centerX = padding + size / 2;
    const centerY = padding + size / 2;

    return stops.map(stop => {
      const pos = stopPositions.get(stop.id) || { x: centerX, y: centerY };
      return { ...stop, x: pos.x, y: pos.y };
    });
  }

  private arrangeInGrid(stops: NetworkStop[]): LayoutStop[] {
    const padding = SchematicLayoutService.PADDING;
    const size = SchematicLayoutService.CANVAS_SIZE - 2 * padding;

    const cols = Math.ceil(Math.sqrt(stops.length));
    const rows = Math.ceil(stops.length / cols);
    const cellWidth = size / cols;
    const cellHeight = size / rows;

    return stops.map((stop, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return {
        ...stop,
        x: padding + col * cellWidth + cellWidth / 2,
        y: padding + row * cellHeight + cellHeight / 2
      };
    });
  }

  private calculateDataBounds(stops: NetworkStop[]): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const stop of stops) {
      const x = stop.schematicX ?? stop.longitude;
      const y = stop.schematicY ?? stop.latitude;

      if (x !== null) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
      if (y !== null) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    // Handle edge cases
    if (minX === Infinity) minX = 0;
    if (maxX === -Infinity) maxX = 1;
    if (minY === Infinity) minY = 0;
    if (maxY === -Infinity) maxY = 1;

    // Ensure some range
    if (maxX === minX) { minX -= 0.01; maxX += 0.01; }
    if (maxY === minY) { minY -= 0.01; maxY += 0.01; }

    return { minX, maxX, minY, maxY };
  }

  private calculateStopPositionFromCoords(
    stop: NetworkStop,
    dataBounds: { minX: number; maxX: number; minY: number; maxY: number }
  ): LayoutStop {
    const rawX = stop.schematicX ?? stop.longitude;
    const rawY = stop.schematicY ?? stop.latitude;

    if (rawX === null || rawY === null) {
      return { ...stop, x: SchematicLayoutService.CANVAS_SIZE / 2, y: SchematicLayoutService.CANVAS_SIZE / 2 };
    }

    const padding = SchematicLayoutService.PADDING;
    const availableSize = SchematicLayoutService.CANVAS_SIZE - 2 * padding;

    const rangeX = dataBounds.maxX - dataBounds.minX;
    const x = padding + ((rawX - dataBounds.minX) / rangeX) * availableSize;

    const rangeY = dataBounds.maxY - dataBounds.minY;
    const y = padding + ((dataBounds.maxY - rawY) / rangeY) * availableSize;

    return { ...stop, x, y };
  }

  private calculateLayoutBounds(): LayoutBounds {
    const size = SchematicLayoutService.CANVAS_SIZE;
    return {
      minX: 0,
      minY: 0,
      maxX: size,
      maxY: size,
      width: size,
      height: size
    };
  }
}
