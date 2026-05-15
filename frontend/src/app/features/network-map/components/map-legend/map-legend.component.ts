import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-map-legend',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend" [class.collapsed]="!open()">
      <button
        type="button"
        class="legend-toggle"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="open() ? 'Hide legend' : 'Show legend'"
      >
        <mat-icon>{{ open() ? 'expand_more' : 'info_outline' }}</mat-icon>
        @if (open()) {
          <span class="legend-toggle-label">Legend</span>
        }
      </button>
      @if (open()) {
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
      }
    </div>
  `,
  styles: `
    .legend {
      position: absolute;
      bottom: 16px;
      left: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: var(--app-map-overlay-bg);
      border: 1px solid var(--app-map-outline);
      border-radius: var(--app-radius-sm);
      padding: 8px 12px;
      box-shadow: 0 1px 4px var(--app-map-shadow);
      z-index: 2;
      pointer-events: auto;
      transition: padding 120ms ease;
    }

    .legend.collapsed {
      padding: 4px;
    }

    .legend-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 4px;
      margin: -2px -2px 2px;
      border: none;
      border-radius: var(--app-radius-xs);
      background: transparent;
      color: var(--app-map-on-surface-variant);
      font-size: var(--m3-type-label-small);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: background 120ms ease;
    }

    .legend-toggle:hover {
      background: var(--app-map-surface-container-high);
    }

    .legend-toggle mat-icon {
      font-size: var(--m3-type-body-large);
      width: 16px;
      height: 16px;
    }

    .legend.collapsed .legend-toggle {
      margin: 0;
    }

    .legend-toggle-label {
      line-height: 1;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--m3-type-label-medium);
      color: var(--app-map-on-surface-variant);
      white-space: nowrap;
    }

    .legend-item svg {
      flex-shrink: 0;
    }

    .alert-badge-critical circle { fill: var(--app-critical); }

    :host-context(.dark-theme) .legend {
      border-color: var(--app-map-surface-container-higher);
    }

    @media (max-width: 600px) {
      .legend {
        padding: 8px 10px;
        gap: 4px;
        bottom: 8px;
        left: 8px;
      }

      .legend-item {
        font-size: var(--m3-type-label-small);
        gap: 6px;
      }

      .legend-item svg {
        width: 14px;
        height: 14px;
      }
    }
  `,
})
export class MapLegendComponent {
  hasHiddenLines = input(false);
  hasStopAlerts = input(false);

  readonly open = signal(true);

  toggle(): void {
    this.open.update(v => !v);
  }
}
