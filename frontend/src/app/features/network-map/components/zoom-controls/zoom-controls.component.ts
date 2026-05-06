import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-zoom-controls',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="zoom-controls">
      <button class="zoom-btn" type="button" (click)="zoomIn.emit()" title="Zoom in" aria-label="Zoom in">
        <mat-icon aria-hidden="true">add</mat-icon>
      </button>
      <button class="zoom-btn" type="button" (click)="resetView.emit()" title="Reset view" aria-label="Reset view">
        <mat-icon aria-hidden="true">fit_screen</mat-icon>
      </button>
      <button class="zoom-btn" type="button" (click)="zoomOut.emit()" title="Zoom out" aria-label="Zoom out">
        <mat-icon aria-hidden="true">remove</mat-icon>
      </button>
    </div>
  `,
  styles: `
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
      border: 1px solid var(--app-map-outline);
      border-radius: 50%;
      background: var(--app-map-surface);
      color: var(--app-map-on-surface-variant);
      cursor: pointer;
      box-shadow: 0 1px 4px var(--app-map-shadow);
    }

    .zoom-btn:hover {
      background: var(--app-map-surface-container-high);
    }

    .zoom-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    :host-context(.dark-theme) .zoom-btn {
      background: var(--app-map-surface-container-high);
      border-color: var(--app-map-surface-container-higher);
    }

    :host-context(.dark-theme) .zoom-btn:hover {
      background: var(--app-map-surface-container-higher);
    }

    @media (max-width: 600px) {
      .zoom-controls {
        bottom: 8px;
        right: 8px;
      }
    }
  `,
})
export class ZoomControlsComponent {
  zoomIn = output();
  zoomOut = output();
  resetView = output();
}
