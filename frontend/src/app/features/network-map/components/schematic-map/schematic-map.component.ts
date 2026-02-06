import {
  Component,
  input,
  output,
  signal,
  computed,
  ElementRef,
  viewChild,
  effect
} from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MessageSeverity, NetworkLine, NetworkMapAlerts } from '@shared/models';
import { LayoutStop } from '../../services/schematic-layout.service';
import { RouteResult } from '../../services/route-finder.service';
import { SvgPanZoom } from '../../utils/svg-pan-zoom';
import { exportSvgToFile } from '../../utils/svg-export';

interface NetworkLineRow {
  line: NetworkLine;
  y: number;
  stops: { stop: LayoutStop; x: number }[];
  path: string;
}

interface InterchangeConnector {
  stopId: string;
  name: string;
  x: number;
  minY: number;
  maxY: number;
}

interface NetworkStopLabel {
  stop: LayoutStop;
  lineId: string;
  x: number;
  y: number;
}

function severityRank(s: MessageSeverity): number {
  switch (s) { case 'INFO': return 0; case 'WARNING': return 1; case 'CRITICAL': return 2; }
}

@Component({
  selector: 'app-schematic-map',
  standalone: true,
  imports: [MatExpansionModule, MatIconModule],
  template: `
    <div class="map-container" #container>
      <!-- Line filter chips -->
      <div class="line-filters">
        <button
          class="filter-chip all-chip"
          [class.active]="visibleLineCodes().length === sortedLines().length"
          (click)="toggleAllLines()"
        >All</button>
        @for (line of sortedLines(); track line.id) {
          <button
            class="filter-chip"
            [class.active]="visibleCodeSet().has(line.code)"
            [style.--chip-color]="line.color"
            (click)="toggleLine(line.code)"
            (dblclick)="showOnlyLine(line.code)"
          >{{ line.code }}@if (getLineAlertSeverity(line.id); as sev) {<span class="chip-alert-dot" [class]="'chip-alert-dot-' + sev.toLowerCase()"></span>}</button>
        }
      </div>

      @if (visibleLineCodes().length === 0) {
        <div class="empty-selection">
          <span class="empty-selection-text">Select a line to display it on the map</span>
        </div>
      } @else {
      <!-- Diagram with zoom/pan -->
      <div
        class="line-diagram-wrapper"
        (wheel)="onWheel($event)"
        (mousedown)="onPointerDown($event)"
        (mousemove)="onPointerMove($event)"
        (mouseup)="onPointerUp()"
        (mouseleave)="onPointerUp()"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onPointerUp()"
        [class.grabbing]="isPanning()"
      >
        <svg
          #svgElement
          [attr.viewBox]="currentViewBox()"
          preserveAspectRatio="xMidYMid meet"
          class="line-diagram network-diagram"
        >
          <!-- Interchange connectors (dashed vertical lines) — multi-line only -->
          @if (!isSingleLineMode()) {
            @for (conn of interchangeConnectors(); track conn.stopId) {
              <line
                [attr.x1]="conn.x" [attr.y1]="conn.minY"
                [attr.x2]="conn.x" [attr.y2]="conn.maxY"
                class="interchange-connector"
                [class.route-dimmed]="hasRoute() && !routeTransferIds().has(conn.stopId)"
              />
            }
          }

          <!-- Line paths -->
          @for (row of networkLineRows(); track row.line.id) {
            <path
              [attr.d]="row.path"
              [attr.stroke]="row.line.color"
              [attr.stroke-width]="isSingleLineMode() ? 8 : 4"
              fill="none"
              stroke-linecap="round"
              class="network-line-path"
              [class.route-dimmed]="hasRoute()"
            />
          }

          <!-- Route overlay paths (highlighted active route) -->
          @if (hasRoute()) {
            @for (overlay of routeOverlayPaths(); track overlay.lineId) {
              <path
                [attr.d]="overlay.path"
                [attr.stroke]="overlay.color"
                [attr.stroke-width]="isSingleLineMode() ? 10 : 6"
                fill="none"
                stroke-linecap="round"
                class="route-active-path"
              />
            }
            @for (arrow of routeDirectionArrows(); track $index) {
              <g [attr.transform]="'translate(' + arrow.x + ',' + arrow.y + ')'" class="route-arrow">
                <polygon
                  [attr.points]="arrow.right ? '-5,-4 5,0 -5,4' : '5,-4 -5,0 5,4'"
                  fill="white"
                  opacity="0.9"
                />
              </g>
            }
          }

          <!-- Line code badges + name (left of each row) -->
          @for (row of networkLineRows(); track row.line.id) {
            @if (row.stops.length > 0) {
              <g [attr.transform]="'translate(' + (row.stops[0].x - 30) + ',' + row.y + ')'"
                 [class.route-dimmed]="hasRoute() && !routeActiveEdges().has(row.line.id)">
                <rect
                  [attr.x]="-16"
                  [attr.y]="-9"
                  [attr.width]="getLineBadgeWidth(row.line.code)"
                  height="18"
                  rx="4"
                  [attr.fill]="row.line.color"
                  class="line-badge-bg"
                />
                <text
                  [attr.x]="getLineBadgeWidth(row.line.code) / 2 - 16"
                  dominant-baseline="central"
                  text-anchor="middle"
                  class="line-badge-text"
                >{{ row.line.code }}</text>
                @if (row.line.name && row.line.name !== row.line.code) {
                  <g [attr.transform]="'translate(-16, 20)'">
                    @if (row.line.type) {
                      <g transform="translate(0, -5) scale(0.5)" class="line-type-icon">
                        <path [attr.d]="getTransportIcon(row.line.type)"/>
                      </g>
                    }
                    <text
                      [attr.x]="row.line.type ? 14 : 0"
                      dominant-baseline="central"
                      class="line-name-label"
                    >{{ row.line.name }}</text>
                  </g>
                }
              </g>
            }
          }

          <!-- Stop circles -->
          @for (row of networkLineRows(); track row.line.id) {
            @for (s of row.stops; track s.stop.id) {
              <g
                [attr.transform]="'translate(' + s.x + ',' + row.y + ')'"
                class="stop-group"
                [class.route-dimmed]="hasRoute() && !isStopActiveOnLine(s.stop.id, row.line.id)"
                (click)="onStopClick(s.stop, $event)"
              >
                <circle
                  [attr.r]="getStopRadius(s.stop.id, row)"
                  [attr.fill]="isInterchange(s.stop) ? 'white' : row.line.color"
                  [attr.stroke]="isInterchange(s.stop) ? '#333' : 'white'"
                  [attr.stroke-width]="isSingleLineMode() ? 3 : 2"
                  class="stop-circle"
                  [class.route-active]="hasRoute() && isStopActiveOnLine(s.stop.id, row.line.id)"
                  [class.route-transfer]="routeTransferIds().has(s.stop.id) && isStopActiveOnLine(s.stop.id, row.line.id)"
                />
                @if (isRowTerminus(s.stop.id, row)) {
                  <circle
                    [attr.r]="isSingleLineMode() ? 8 : 4"
                    [attr.fill]="isInterchange(s.stop) ? row.line.color : 'white'"
                  />
                }
                @if (isInterchange(s.stop) && !isRowTerminus(s.stop.id, row)) {
                  <circle
                    [attr.r]="isSingleLineMode() ? 5 : 2.5"
                    fill="#333"
                  />
                }

                <!-- Route markers: departure / arrival / transfer (only on relevant line row) -->
                @if (departureStopId() === s.stop.id && isStopActiveOnLine(s.stop.id, row.line.id)) {
                  <g class="route-marker route-marker-departure">
                    <circle [attr.r]="isSingleLineMode() ? 16 : 10" fill="#4caf50" opacity="0.9" />
                    <text text-anchor="middle" dominant-baseline="central" fill="white"
                          [attr.font-size]="isSingleLineMode() ? 12 : 8" font-weight="bold">D</text>
                  </g>
                } @else if (arrivalStopId() === s.stop.id && isStopActiveOnLine(s.stop.id, row.line.id)) {
                  <g class="route-marker route-marker-arrival">
                    <circle [attr.r]="isSingleLineMode() ? 16 : 10" fill="#f44336" opacity="0.9" />
                    <text text-anchor="middle" dominant-baseline="central" fill="white"
                          [attr.font-size]="isSingleLineMode() ? 12 : 8" font-weight="bold">A</text>
                  </g>
                } @else if (routeTransferIds().has(s.stop.id) && isStopActiveOnLine(s.stop.id, row.line.id)) {
                  <g class="route-marker route-marker-transfer">
                    <circle [attr.r]="isSingleLineMode() ? 12 : 8" fill="white" stroke="#333" stroke-width="1.5" />
                    <text text-anchor="middle" dominant-baseline="central" fill="#333"
                          [attr.font-size]="isSingleLineMode() ? 9 : 6" font-weight="bold">T</text>
                  </g>
                }

                <!-- Search highlight pulse -->
                @if (highlightedStopId() === s.stop.id) {
                  <circle class="search-highlight-ring" [attr.r]="isSingleLineMode() ? 20 : 14" />
                }

                <!-- Alert severity badge -->
                @if (!hasRoute() && alertSeverityMap().get(s.stop.id); as severity) {
                  <g [attr.transform]="'translate(' + getAlertOffset() + ',' + (-getAlertOffset()) + ')'"
                     [class]="'alert-badge alert-badge-' + severity.toLowerCase()">
                    <circle r="5" stroke="white" stroke-width="1.5" />
                    <text text-anchor="middle" dominant-baseline="central" fill="white"
                          font-size="6" font-weight="bold">!</text>
                  </g>
                }

                <!-- Badges for hidden lines passing through this stop -->
                @if (!hasRoute() && hiddenLinesMap().get(s.stop.id); as hiddenCodes) {
                  <g [attr.transform]="'translate(0, ' + (isSingleLineMode() ? 28 : 18) + ')'">
                    @for (code of hiddenCodes; track code; let j = $index) {
                      <g [attr.transform]="getBadgeTransform(j, hiddenCodes.length)">
                        <circle r="9" [attr.fill]="getLineColor(code)" />
                        <text
                          text-anchor="middle"
                          dominant-baseline="central"
                          fill="white"
                          font-size="8"
                          font-weight="bold"
                        >{{ code }}</text>
                      </g>
                    }
                  </g>
                }
              </g>
            }
          }

          <!-- Labels -->
          @for (label of networkStopLabels(); track $index) {
            @if (isStopLabelVisible(label.stop)) {
              <g [attr.transform]="'translate(' + label.x + ',' + label.y + ')'"
                 [class.route-dimmed]="hasRoute() && !isStopActiveOnLine(label.stop.id, label.lineId)">
                <text
                  transform="rotate(-45) translate(8, -8)"
                  class="stop-name"
                  [class.network-stop-name]="!isSingleLineMode()"
                  [class.interchange]="isInterchange(label.stop)"
                  [class.terminus]="isNetworkTerminus(label.stop)"
                >
                  {{ label.stop.name }}
                </text>
              </g>
            }
          }
        </svg>

        <!-- Alert overlay -->
        @if (alerts().networkAlerts.length > 0 || visibleLineAlerts().length > 0) {
          <div class="alert-overlay">
            @if (alerts().networkAlerts.length > 0) {
              <div class="alert-section-label">Network</div>
              <mat-accordion multi>
                @for (alert of alerts().networkAlerts; track $index) {
                  <mat-expansion-panel [class]="'alert-panel alert-' + alert.severity.toLowerCase()">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <span class="alert-severity-dot" [class]="'dot-' + alert.severity.toLowerCase()"></span>
                        {{ alert.title }}
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    @if (alert.content) {
                      <p class="alert-content">{{ alert.content }}</p>
                    }
                  </mat-expansion-panel>
                }
              </mat-accordion>
            }
            @if (visibleLineAlerts().length > 0) {
              <div class="alert-section-label">Lines</div>
              <mat-accordion multi>
                @for (entry of visibleLineAlerts(); track entry.line.id) {
                  @for (alert of entry.alerts; track $index) {
                    <mat-expansion-panel [class]="'alert-panel alert-' + alert.severity.toLowerCase()">
                      <mat-expansion-panel-header>
                        <mat-panel-title>
                          <span class="alert-line-badge" [style.backgroundColor]="entry.line.color">{{ entry.line.code }}</span>
                          {{ alert.title }}
                        </mat-panel-title>
                      </mat-expansion-panel-header>
                      @if (alert.content) {
                        <p class="alert-content">{{ alert.content }}</p>
                      }
                    </mat-expansion-panel>
                  }
                }
              </mat-accordion>
            }
          </div>
        }

        <!-- Legend -->
        <div class="legend">
          <div class="legend-item">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <circle cx="9" cy="9" r="6" fill="#888" stroke="white" stroke-width="2"/>
            </svg>
            <span>Stop</span>
          </div>
          <div class="legend-item">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <circle cx="9" cy="9" r="7" fill="#888" stroke="white" stroke-width="2"/>
              <circle cx="9" cy="9" r="4" fill="white"/>
            </svg>
            <span>Terminus</span>
          </div>
          <div class="legend-item">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <circle cx="9" cy="9" r="6" fill="white" stroke="#333" stroke-width="2"/>
              <circle cx="9" cy="9" r="2.5" fill="#333"/>
            </svg>
            <span>Interchange</span>
          </div>
          @if (hasHiddenLines()) {
            <div class="legend-item">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <circle cx="9" cy="9" r="8" fill="#666"/>
                <text x="9" y="9" text-anchor="middle" dominant-baseline="central" fill="white" font-size="7" font-weight="bold">X</text>
              </svg>
              <span>Hidden line</span>
            </div>
          }
          @if (hasStopAlerts()) {
            <div class="legend-item legend-alert">
              <svg width="18" height="18" viewBox="0 0 18 18" class="alert-badge-critical">
                <circle cx="9" cy="9" r="5" stroke="white" stroke-width="1.5"/>
                <text x="9" y="9" text-anchor="middle" dominant-baseline="central" fill="white" font-size="6" font-weight="bold">!</text>
              </svg>
              <span>Alert</span>
            </div>
          }
        </div>

        <!-- Projected content (search panels, etc.) -->
        <ng-content />

        <!-- Zoom controls -->
        <div class="zoom-controls">
          <button class="zoom-btn" (click)="zoomIn()" title="Zoom in">
            <mat-icon>add</mat-icon>
          </button>
          <button class="zoom-btn" (click)="resetView()" title="Reset view">
            <mat-icon>fit_screen</mat-icon>
          </button>
          <button class="zoom-btn" (click)="zoomOut()" title="Zoom out">
            <mat-icon>remove</mat-icon>
          </button>
          <button class="zoom-btn" (click)="exportSvg()" title="Download SVG">
            <mat-icon>download</mat-icon>
          </button>
        </div>
      </div>

      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .map-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
    }

    /* --- Filter chips --- */

    .line-filters {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
      flex-wrap: wrap;
      align-items: center;
    }

    .filter-chip {
      position: relative;
      padding: 6px 14px;
      border: 2px solid var(--chip-color, #888);
      background: white;
      color: var(--chip-color, #888);
      font-weight: 700;
      font-size: 13px;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.15s;
      user-select: none;
    }

    .filter-chip:hover {
      opacity: 0.85;
    }

    .filter-chip.active {
      background: var(--chip-color, #888);
      color: white;
    }

    .filter-chip:not(.active) {
      opacity: 0.45;
    }

    .chip-alert-dot {
      position: absolute;
      top: -3px;
      right: -3px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1.5px solid white;
    }

    .chip-alert-dot-critical { background: var(--app-critical); }
    .chip-alert-dot-warning { background: var(--app-warning); }
    .chip-alert-dot-info { background: var(--app-info); }

    .all-chip {
      --chip-color: #555;
    }

    /* --- Alert overlay --- */

    .alert-overlay {
      position: absolute;
      top: 16px;
      left: 16px;
      z-index: 3;
      max-width: 340px;
      max-height: calc(100% - 32px);
      overflow-y: auto;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .alert-section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      padding: 6px 4px 2px;
    }

    .alert-section-label:not(:first-child) {
      margin-top: 6px;
    }

    .alert-panel {
      --mat-expansion-container-background-color: rgba(255, 255, 255, 0.88);
      --mat-expansion-container-shape: 8px;
      --mat-expansion-header-text-size: 13px;
      --mat-expansion-header-text-weight: 600;
      backdrop-filter: blur(8px);
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
    }

    .alert-panel + .alert-panel {
      margin-top: 4px;
    }

    .alert-severity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dot-critical { background: var(--app-critical); }
    .dot-warning { background: var(--app-warning); }
    .dot-info { background: var(--app-info); }

    .alert-line-badge {
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .alert-panel mat-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .alert-critical { --mat-expansion-header-text-color: var(--app-critical); }
    .alert-warning { --mat-expansion-header-text-color: var(--app-warning); }
    .alert-info { --mat-expansion-header-text-color: var(--app-info); }

    .alert-content {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.5;
      color: #555;
    }


    .empty-selection {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-selection-text {
      color: #999;
      font-size: 15px;
    }

    /* --- Diagram --- */

    .line-diagram-wrapper {
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    .line-diagram-wrapper.grabbing {
      cursor: grabbing;
    }

    .line-diagram {
      display: block;
      width: 100%;
      max-height: 100%;
    }

    .network-diagram {
      height: 100%;
    }

    .network-line-path {
      opacity: 0.85;
    }

    .interchange-connector {
      stroke: rgba(150, 150, 150, 0.25);
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
    }

    .line-badge-bg {
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
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

    .legend {
      position: absolute;
      bottom: 16px;
      left: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid #d0d0d0;
      border-radius: 8px;
      padding: 10px 14px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      z-index: 2;
      pointer-events: none;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #555;
      white-space: nowrap;
    }

    .legend-item svg {
      flex-shrink: 0;
    }

    .zoom-controls {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 2;
    }

    .zoom-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid #d0d0d0;
      border-radius: 50%;
      background: white;
      color: #444;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    }

    .zoom-btn:hover {
      background: #f0f0f0;
    }

    .zoom-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .stop-group {
      cursor: pointer;
    }

    .stop-group:hover .stop-circle {
      stroke-width: 4;
      filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35));
    }

    .stop-circle {
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
      transition: stroke-width 0.15s ease, filter 0.15s ease, opacity 0.3s ease;
    }

    .search-highlight-ring {
      fill: none;
      stroke: #64b5f6;
      stroke-width: 3;
      animation: search-pulse 1.5s ease-in-out infinite;
    }

    @keyframes search-pulse {
      0%, 100% { opacity: 1; stroke-width: 3; }
      50% { opacity: 0.4; stroke-width: 5; }
    }

    /* --- Route overlay --- */

    .route-dimmed {
      opacity: 0.15;
      transition: opacity 0.3s ease;
    }

    .route-active-path {
      filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.25));
      transition: opacity 0.3s ease;
    }

    .stop-circle.route-active,
    .stop-circle.route-transfer {
      filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.3));
      stroke-width: 3;
    }

    .route-arrow {
      pointer-events: none;
      filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.4));
    }

    .route-marker {
      pointer-events: none;
    }

    .route-marker-departure circle {
      filter: drop-shadow(0 0 6px rgba(76, 175, 80, 0.6));
    }

    .route-marker-arrival circle {
      filter: drop-shadow(0 0 6px rgba(244, 67, 54, 0.6));
    }

    .route-marker-transfer circle {
      filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.2));
    }

    .alert-badge-critical circle { fill: var(--app-critical); }
    .alert-badge-warning circle { fill: var(--app-warning); }
    .alert-badge-info circle { fill: var(--app-info); }

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

    .network-stop-name {
      font-size: 10px;
    }

    .stop-name.interchange {
      font-weight: 700;
      font-size: 13px;
    }

    .stop-name.terminus {
      font-weight: 700;
      font-size: 13px;
    }

    .network-stop-name.interchange {
      font-size: 11px;
    }

    .network-stop-name.terminus {
      font-size: 11px;
    }

    @media (prefers-color-scheme: dark) {
      .map-container {
        background: #1a1a2e;
      }

      .empty-selection-text {
        color: rgba(255, 255, 255, 0.4);
      }

      .alert-panel {
        --mat-expansion-container-background-color: rgba(26, 26, 46, 0.88);
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
      }

      .alert-content {
        color: #aaa;
      }

      .alert-section-label {
        color: #777;
      }

      .chip-alert-dot {
        border-color: #16213e;
      }

      .line-filters {
        background: #16213e;
        border-bottom-color: #2a2a4a;
      }

      .filter-chip {
        background: #1a1a2e;
      }

      .filter-chip.active {
        background: var(--chip-color, #888);
      }

      .line-diagram-wrapper {
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
      }

      .legend {
        background: rgba(26, 26, 46, 0.92);
        border-color: #3a3a5a;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }

      .legend-item {
        color: #bbb;
      }

      .zoom-btn {
        background: #2a2a4a;
        border-color: #3a3a5a;
        color: #ccc;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }

      .zoom-btn:hover {
        background: #3a3a5a;
      }

      .line-name-label {
        fill: #999;
      }

      .line-type-icon path {
        fill: #777;
      }

      .stop-name {
        fill: #e0e0e0;
        stroke: #1a1a2e;
      }

      .interchange-connector {
        stroke: rgba(255, 255, 255, 0.12);
      }

      .route-active-path {
        filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
      }

      .stop-circle.route-active,
      .stop-circle.route-transfer {
        filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5));
      }
    }

    @media (max-width: 600px) {
      .line-filters {
        padding: 10px 12px;
        gap: 6px;
      }

      .filter-chip {
        padding: 5px 10px;
        font-size: 12px;
      }

      .line-diagram-wrapper {
        padding: 20px 10px;
      }

      .legend {
        padding: 8px 10px;
        gap: 4px;
      }

      .legend-item {
        font-size: 11px;
        gap: 6px;
      }

      .legend-item svg {
        width: 14px;
        height: 14px;
      }
    }
  `
})
export class SchematicMapComponent {
  lines = input.required<NetworkLine[]>();
  stops = input.required<LayoutStop[]>();
  lineColorMap = input.required<Map<string, string>>();
  visibleLineCodes = input.required<string[]>();
  alerts = input<NetworkMapAlerts>({ networkAlerts: [], lineAlerts: {}, stopAlerts: {} });
  routeResult = input<RouteResult | null>(null);
  departureStopId = input<string | null>(null);
  arrivalStopId = input<string | null>(null);
  highlightedStopId = input<string | null>(null);

  stopSelected = output<LayoutStop>();
  filterChange = output<string[]>();

  svgElement = viewChild<ElementRef<SVGSVGElement>>('svgElement');
  container = viewChild<ElementRef<HTMLDivElement>>('container');

  isPanning = signal(false);

  private readonly panZoom = new SvgPanZoom();
  private readonly NETWORK_PADDING = 80;

  sortedLines = computed(() => {
    return [...this.lines()].sort((a, b) => {
      const typeA = a.code.replace(/[0-9]/g, '');
      const typeB = b.code.replace(/[0-9]/g, '');
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      const numA = parseInt(a.code.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.code.replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });
  });

  /** O(1) lookup set derived from the input */
  visibleCodeSet = computed(() => new Set(this.visibleLineCodes()));

  /** Lines filtered to only those currently visible */
  visibleLines = computed(() => {
    const codes = this.visibleCodeSet();
    return this.sortedLines().filter(l => codes.has(l.code));
  });

  isSingleLineMode = computed(() => this.visibleLines().length === 1);

  /** Whether some lines are filtered out */
  hasHiddenLines = computed(() => this.visibleLineCodes().length < this.sortedLines().length);

  // --- Route overlay computed ---

  hasRoute = computed(() => this.routeResult() !== null);
  routeTransferIds = computed(() => new Set(this.routeResult()?.transferStopIds ?? []));

  /** Map<lineId, Set<edgeKey>> where edgeKey = "stopA|stopB" (sorted) */
  routeActiveEdges = computed(() => {
    const result = this.routeResult();
    if (!result) return new Map<string, Set<string>>();

    const map = new Map<string, Set<string>>();
    for (const segment of result.segments) {
      if (!map.has(segment.lineId)) map.set(segment.lineId, new Set());
      const edges = map.get(segment.lineId)!;
      for (let i = 0; i < segment.stopIds.length - 1; i++) {
        const a = segment.stopIds[i];
        const b = segment.stopIds[i + 1];
        edges.add(a < b ? `${a}|${b}` : `${b}|${a}`);
      }
    }
    return map;
  });

  /** Map<lineId, Set<stopId>> — stops that touch an active edge on that line */
  routeStopsByLine = computed(() => {
    const result = this.routeResult();
    if (!result) return new Map<string, Set<string>>();

    const map = new Map<string, Set<string>>();
    for (const segment of result.segments) {
      if (!map.has(segment.lineId)) map.set(segment.lineId, new Set());
      const stops = map.get(segment.lineId)!;
      for (const id of segment.stopIds) {
        stops.add(id);
      }
    }
    return map;
  });

  /** For each visible line row, build a path covering only the route edges */
  routeOverlayPaths = computed(() => {
    const activeEdges = this.routeActiveEdges();
    const rows = this.networkLineRows();
    const result: { lineId: string; color: string; path: string }[] = [];

    for (const row of rows) {
      const lineEdges = activeEdges.get(row.line.id);
      if (!lineEdges || lineEdges.size === 0) continue;

      // Find consecutive segments of active edges in this row
      let pathD = '';
      let inSegment = false;

      for (let i = 0; i < row.stops.length - 1; i++) {
        const a = row.stops[i].stop.id;
        const b = row.stops[i + 1].stop.id;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;

        if (lineEdges.has(key)) {
          if (!inSegment) {
            pathD += `M ${row.stops[i].x},${row.y} `;
            inSegment = true;
          }
          pathD += `L ${row.stops[i + 1].x},${row.y} `;
        } else {
          inSegment = false;
        }
      }

      if (pathD) {
        result.push({ lineId: row.line.id, color: row.line.color, path: pathD.trim() });
      }
    }

    return result;
  });

  /** Direction arrows placed along each route segment */
  routeDirectionArrows = computed(() => {
    const result = this.routeResult();
    if (!result) return [];

    const rows = this.networkLineRows();
    const rowByLine = new Map(rows.map(r => [r.line.id, r]));
    const arrows: { x: number; y: number; right: boolean; color: string }[] = [];
    const ARROW_INTERVAL = 120;

    for (const segment of result.segments) {
      const row = rowByLine.get(segment.lineId);
      if (!row || segment.stopIds.length < 2) continue;

      const stopXMap = new Map(row.stops.map(s => [s.stop.id, s.x]));
      const firstX = stopXMap.get(segment.stopIds[0]);
      const lastX = stopXMap.get(segment.stopIds[segment.stopIds.length - 1]);
      if (firstX === undefined || lastX === undefined) continue;

      const right = lastX > firstX;
      const minX = Math.min(firstX, lastX);
      const maxX = Math.max(firstX, lastX);
      const span = maxX - minX;

      // Place arrows at regular intervals, at least one at the midpoint
      const count = Math.max(1, Math.floor(span / ARROW_INTERVAL));
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1);
        arrows.push({ x: minX + span * t, y: row.y, right, color: segment.lineColor });
      }
    }

    return arrows;
  });

  stopsMap = computed(() => {
    const map = new Map<string, LayoutStop>();
    for (const stop of this.stops()) {
      map.set(stop.id, stop);
    }
    return map;
  });

  /** ViewBox that tightly wraps the visible content with margins for labels/badges */
  baseViewBox = computed(() => {
    const rows = this.networkLineRows();
    if (rows.length === 0) {
      return { x: 0, y: 0, w: 1000, h: 600 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const row of rows) {
      minY = Math.min(minY, row.y);
      maxY = Math.max(maxY, row.y);
      for (const s of row.stops) {
        minX = Math.min(minX, s.x);
        maxX = Math.max(maxX, s.x);
      }
    }

    const sideMargin = 80;
    const topMargin = 120;  // rotated labels
    const bottomMargin = this.isSingleLineMode() ? 80 : 50; // interchange badges in single-line

    const contentW = Math.max((maxX - minX) + sideMargin * 2, 200);
    const w = contentW / 0.6;  // content occupies ~60% of the view width
    const extraSide = (w - contentW) / 2;

    const x = minX - sideMargin - extraSide;
    const y = minY - topMargin;
    const h = Math.max((maxY - minY) + topMargin + bottomMargin, 200);

    return { x, y, w, h };
  });

  currentViewBox = signal('0 0 800 220');

  // --- Network computed (now always active, filtered by visibleLines) ---

  /**
   * Per-line stop X positions. Each line stretches across the full width.
   * Interchange stops are fixed to a shared X (average of desired positions)
   * so that vertical connectors stay aligned across rows.
   */
  private networkStopPositions = computed<Map<string, Map<string, number>>>(() => {
    const lines = this.visibleLines();
    const pad = this.NETWORK_PADDING;
    const size = 1000 - 2 * pad;

    // Step 1: desired even spacing per line (full width)
    const desiredPos = new Map<string, Map<string, number>>();
    for (const line of lines) {
      const it = line.itineraries[0] ?? [];
      if (it.length === 0) continue;
      const spacing = it.length > 1 ? size / (it.length - 1) : 0;
      const m = new Map<string, number>();
      it.forEach((id, i) => m.set(id, pad + i * spacing));
      desiredPos.set(line.id, m);
    }

    // Step 2: find interchange stops, compute average X
    const stopLineIds = new Map<string, string[]>();
    for (const line of lines) {
      for (const id of (line.itineraries[0] ?? [])) {
        if (!stopLineIds.has(id)) stopLineIds.set(id, []);
        stopLineIds.get(id)!.push(line.id);
      }
    }

    const interchangeX = new Map<string, number>();
    for (const [stopId, lineIds] of stopLineIds) {
      if (lineIds.length <= 1) continue;
      let sum = 0;
      for (const lid of lineIds) sum += desiredPos.get(lid)!.get(stopId)!;
      interchangeX.set(stopId, sum / lineIds.length);
    }

    // Step 2.5: enforce minimum spacing between interchange positions globally.
    const maxStops = Math.max(...lines.map(l => (l.itineraries[0] ?? []).length), 1);
    const minGap = Math.max(40, size / (maxStops * 1.5));

    for (const line of lines) {
      const it = line.itineraries[0] ?? [];
      const ixInOrder: string[] = it.filter(id => interchangeX.has(id));
      if (ixInOrder.length < 2) continue;

      for (let i = 1; i < ixInOrder.length; i++) {
        const prevX = interchangeX.get(ixInOrder[i - 1])!;
        const curX = interchangeX.get(ixInOrder[i])!;
        if (curX - prevX < minGap) {
          interchangeX.set(ixInOrder[i], prevX + minGap);
        }
      }
    }

    // Step 3: pin edges and redistribute
    const result = new Map<string, Map<string, number>>();
    const leftX = pad;
    const rightX = pad + size;

    for (const line of lines) {
      const it = line.itineraries[0] ?? [];
      if (it.length === 0) continue;

      const lineMap = new Map<string, number>();

      if (it.length === 1) {
        const ix = interchangeX.get(it[0]);
        lineMap.set(it[0], ix ?? leftX + size / 2);
        result.set(line.id, lineMap);
        continue;
      }

      const anchors: { idx: number; x: number }[] = [];

      const firstIx = interchangeX.get(it[0]);
      const firstX = firstIx ?? leftX;
      anchors.push({ idx: 0, x: firstX });
      lineMap.set(it[0], firstX);

      for (let i = 1; i < it.length - 1; i++) {
        const ix = interchangeX.get(it[i]);
        if (ix !== undefined) {
          const prev = anchors[anchors.length - 1];
          const x = Math.max(ix, prev.x + minGap);
          anchors.push({ idx: i, x });
          lineMap.set(it[i], x);
        }
      }

      const lastIx = interchangeX.get(it[it.length - 1]);
      const lastX = lastIx != null ? Math.max(lastIx, anchors[anchors.length - 1].x + minGap) : rightX;
      anchors.push({ idx: it.length - 1, x: lastX });
      lineMap.set(it[it.length - 1], lastX);

      for (let a = 0; a < anchors.length - 1; a++) {
        this.distributeSegment(
          it, anchors[a].idx + 1, anchors[a + 1].idx,
          anchors[a].x, anchors[a + 1].x, lineMap
        );
      }

      result.set(line.id, lineMap);
    }

    return result;
  });

  /** Each line as a horizontal row with its stops positioned across the full width */
  networkLineRows = computed<NetworkLineRow[]>(() => {
    const lines = this.visibleLines();
    const stopsMap = this.stopsMap();
    const posMap = this.networkStopPositions();

    const pad = this.NETWORK_PADDING;
    const size = 1000 - 2 * pad;
    const maxRowSpacing = 120;
    const rowSpacing = lines.length > 1 ? Math.min(maxRowSpacing, size / (lines.length - 1)) : 0;
    const totalHeight = (lines.length - 1) * rowSpacing;
    const baseY = pad + (size - totalHeight) / 2;

    return lines.map((line, idx) => {
      const y = baseY + idx * rowSpacing;
      const itinerary = line.itineraries[0] ?? [];
      const linePos = posMap.get(line.id);

      const stops = itinerary
        .map(id => {
          const stop = stopsMap.get(id);
          const x = linePos?.get(id);
          return stop && x !== undefined ? { stop, x } : null;
        })
        .filter((s): s is { stop: LayoutStop; x: number } => s !== null);

      let path = '';
      if (stops.length >= 2) {
        path = `M ${stops[0].x},${y}`;
        for (let i = 1; i < stops.length; i++) {
          path += ` L ${stops[i].x},${y}`;
        }
      }

      return { line, y, stops, path };
    });
  });

  /** Vertical dashed connectors between rows for interchange stops */
  interchangeConnectors = computed<InterchangeConnector[]>(() => {
    const rows = this.networkLineRows();
    const positions = new Map<string, { name: string; x: number; ys: number[] }>();

    for (const row of rows) {
      for (const { stop, x } of row.stops) {
        if (!positions.has(stop.id)) {
          positions.set(stop.id, { name: stop.name, x, ys: [] });
        }
        positions.get(stop.id)!.ys.push(row.y);
      }
    }

    return [...positions.entries()]
      .filter(([, v]) => v.ys.length > 1)
      .map(([stopId, v]) => ({
        stopId,
        name: v.name,
        x: v.x,
        minY: Math.min(...v.ys),
        maxY: Math.max(...v.ys)
      }));
  });

  /** Labels for stops. Interchange stops appear on every row; others only once (topmost). */
  networkStopLabels = computed<NetworkStopLabel[]>(() => {
    const rows = this.networkLineRows();
    const seen = new Set<string>();
    const labels: NetworkStopLabel[] = [];

    for (const row of rows) {
      for (const { stop, x } of row.stops) {
        const isIc = stop.lineCodes.length > 1;
        if (isIc || !seen.has(stop.id)) {
          seen.add(stop.id);
          labels.push({ stop, lineId: row.line.id, x, y: row.y });
        }
      }
    }

    return labels;
  });

  /** Precomputed map: stopId -> hidden line codes (lines not currently visible) */
  hiddenLinesMap = computed(() => {
    const visible = this.visibleCodeSet();
    const map = new Map<string, string[]>();
    for (const stop of this.stops()) {
      const hidden = stop.lineCodes.filter(code => !visible.has(code));
      if (hidden.length > 0) {
        map.set(stop.id, hidden);
      }
    }
    return map;
  });

  /** Precomputed map: stopId -> highest alert severity */
  alertSeverityMap = computed<Map<string, MessageSeverity>>(() => {
    const stopAlerts = this.alerts().stopAlerts;
    const map = new Map<string, MessageSeverity>();
    for (const [stopId, alerts] of Object.entries(stopAlerts)) {
      if (!alerts?.length) continue;
      const max = alerts.reduce((best, m) =>
        best === null || severityRank(m.severity) > severityRank(best) ? m.severity : best,
        null as MessageSeverity | null,
      );
      if (max) map.set(stopId, max);
    }
    return map;
  });

  /** Set of stop IDs that are terminus in at least one visible line's itinerary */
  private networkTerminusIds = computed(() => {
    const ids = new Set<string>();
    for (const line of this.visibleLines()) {
      for (const itinerary of line.itineraries) {
        if (itinerary.length > 0) {
          ids.add(itinerary[0]);
          ids.add(itinerary[itinerary.length - 1]);
        }
      }
    }
    return ids;
  });

  constructor() {
    // Reset view when layout changes
    effect(() => {
      this.baseViewBox(); // track dependency
      this.visibleLines(); // track dependency
      this.resetView();
    });
  }

  // --- Filter methods ---

  toggleLine(code: string): void {
    const current = new Set(this.visibleCodeSet());
    if (current.has(code)) {
      current.delete(code);
    } else {
      current.add(code);
    }
    this.filterChange.emit([...current]);
  }

  toggleAllLines(): void {
    if (this.visibleLineCodes().length === this.sortedLines().length) {
      this.filterChange.emit([]);
    } else {
      this.filterChange.emit(this.sortedLines().map(l => l.code));
    }
  }

  showOnlyLine(code: string): void {
    this.filterChange.emit([code]);
  }

  // --- Stop helpers ---

  getStopRadius(stopId: string, row: NetworkLineRow): number {
    const terminus = this.isRowTerminus(stopId, row);
    if (this.isSingleLineMode()) {
      return terminus ? 14 : 12;
    }
    return terminus ? 8 : 6;
  }

  isNetworkTerminus(stop: LayoutStop): boolean {
    return this.networkTerminusIds().has(stop.id);
  }

  isRowTerminus(stopId: string, row: NetworkLineRow): boolean {
    const stops = row.stops;
    return stops.length > 0 && (stops[0].stop.id === stopId || stops[stops.length - 1].stop.id === stopId);
  }

  isInterchange(stop: LayoutStop): boolean {
    return stop.lineCodes.length > 1;
  }

  isStopLabelVisible(_stop: LayoutStop): boolean {
    return true;
  }

  /** Whether a stop is part of the active route on a specific line */
  isStopActiveOnLine(stopId: string, lineId: string): boolean {
    return this.routeStopsByLine().get(lineId)?.has(stopId) ?? false;
  }

  getLineBadgeWidth(code: string): number {
    return Math.max(32, code.length * 8 + 16);
  }

  getLineColor(code: string): string {
    return this.lineColorMap().get(code) ?? '#666';
  }

  getTransportIcon(type: string): string {
    switch (type) {
      // Material Design "train" path (simplified, 18x18 viewBox)
      case 'TRAIN': return 'M12 2C8 2 4 2.5 4 6v9.5c0 1.93 1.57 3.5 3.5 3.5L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
      // Material Design "tram" path
      case 'TRAM': return 'M13 5l.75-1.5H17V2H7v1.5h4.75L11 5C7.82 5.26 5 6.76 5 9v9c0 1.38.81 2.56 2 3.12V22c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h4v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-.88c1.19-.56 2-1.74 2-3.12V9c0-2.24-2.82-3.74-6-4zM7.5 19c-.83 0-1.5-.67-1.5-1.5S6.67 16 7.5 16s1.5.67 1.5 1.5S8.33 19 7.5 19zm3.5-7H7V9h4v3zm2 0V9h4v3h-4zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
      // Material Design "directions_bus" path
      case 'BUS': return 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z';
      // Material Design "subway" path
      case 'METRO': return 'M17.8 2.8C16 2.09 13.86 2 12 2c-1.86 0-4 .09-5.8.8C3.53 3.84 2 6.05 2 8.86V22h20V8.86c0-2.81-1.53-5.02-4.2-6.06zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm3.5-7H6V8h5v3zm2 0V8h5v3h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
      default: return '';
    }
  }

  getAlertOffset(): number {
    return this.isSingleLineMode() ? 10 : 6;
  }

  hasStopAlerts(): boolean {
    return Object.keys(this.alerts().stopAlerts).length > 0;
  }

  getLineAlertSeverity(lineId: string): MessageSeverity | null {
    const messages = this.alerts().lineAlerts[lineId];
    if (!messages?.length) return null;
    return messages.reduce((max, m) =>
      max === null || severityRank(m.severity) > severityRank(max) ? m.severity : max,
      null as MessageSeverity | null,
    );
  }

  visibleLineAlerts = computed(() => {
    const lineAlerts = this.alerts().lineAlerts;
    return this.visibleLines()
      .filter(line => lineAlerts[line.id]?.length)
      .map(line => ({ line, alerts: lineAlerts[line.id] }));
  });

  getBadgeTransform(index: number, total: number): string {
    const COLS = 4;
    const GAP = 20;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const colsInRow = row < Math.floor(total / COLS) ? COLS : total % COLS || COLS;
    const x = col * GAP - (colsInRow - 1) * GAP / 2;
    const y = row * GAP;
    return `translate(${x}, ${y})`;
  }

  onStopClick(stop: LayoutStop, event: Event): void {
    event.stopPropagation();
    this.stopSelected.emit(stop);
  }

  /** Evenly distribute stops between two X bounds (exclusive of fixed endpoints) */
  private distributeSegment(
    itinerary: string[], fromIdx: number, toIdx: number,
    fromX: number, toX: number, out: Map<string, number>
  ): void {
    const count = toIdx - fromIdx;
    if (count <= 0) return;
    const totalSlots = count + 1;
    const spacing = (toX - fromX) / totalSlots;
    for (let i = 0; i < count; i++) {
      out.set(itinerary[fromIdx + i], fromX + (i + 1) * spacing);
    }
  }

  // --- Zoom / Pan ---

  zoomIn(): void {
    this.panZoom.zoomIn(this.baseViewBox());
    this.updateViewBox();
  }

  zoomOut(): void {
    this.panZoom.zoomOut(this.baseViewBox());
    this.updateViewBox();
  }

  resetView(): void {
    this.panZoom.reset();
    this.updateViewBox();
  }

  centerOnStop(stopId: string): void {
    let sx: number | null = null;
    let sy: number | null = null;
    for (const row of this.networkLineRows()) {
      for (const s of row.stops) {
        if (s.stop.id === stopId) {
          sx = s.x;
          sy = row.y;
          break;
        }
      }
      if (sx !== null) break;
    }
    if (sx === null || sy === null) return;

    this.panZoom.centerOn(sx, sy, this.baseViewBox());
    this.updateViewBox();
  }

  exportSvg(): void {
    const svgEl = this.svgElement()?.nativeElement;
    if (!svgEl) return;

    exportSvgToFile({
      svgElement: svgEl,
      baseViewBox: this.baseViewBox(),
      visibleLineCodes: this.visibleLineCodes(),
      allLineCodes: this.sortedLines().map(l => l.code),
    });
  }

  onWheel(event: WheelEvent): void {
    const svg = this.svgElement()?.nativeElement;
    if (!svg) return;
    this.panZoom.onWheel(event, svg.getBoundingClientRect(), this.baseViewBox());
    this.updateViewBox();
  }

  onPointerDown(event: MouseEvent): void {
    if (this.panZoom.onPointerDown(event)) {
      this.isPanning.set(true);
    }
  }

  onPointerMove(event: MouseEvent): void {
    if (!this.panZoom.isDragging) return;
    const svg = this.svgElement()?.nativeElement;
    if (!svg) return;
    this.panZoom.onPointerMove(event, svg.getBoundingClientRect(), this.baseViewBox());
    this.updateViewBox();
  }

  onPointerUp(): void {
    this.panZoom.onPointerUp();
    this.isPanning.set(false);
  }

  onTouchStart(event: TouchEvent): void {
    this.panZoom.onTouchStart(event);
    if (event.touches.length === 1) {
      this.isPanning.set(true);
    }
  }

  onTouchMove(event: TouchEvent): void {
    const svg = this.svgElement()?.nativeElement;
    if (!svg) return;
    this.panZoom.onTouchMove(event, svg.getBoundingClientRect(), this.baseViewBox());
    this.updateViewBox();
  }

  private updateViewBox(): void {
    this.currentViewBox.set(this.panZoom.computeViewBox(this.baseViewBox()));
  }
}
