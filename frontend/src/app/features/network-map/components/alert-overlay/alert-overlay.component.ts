import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { AlertMessage, NetworkLine } from '@shared/models';

export interface VisibleLineAlert {
  line: NetworkLine;
  alerts: AlertMessage[];
}

@Component({
  selector: 'app-alert-overlay',
  standalone: true,
  imports: [MatExpansionModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasContent()) {
      <div class="alert-overlay">
        @if (networkAlerts().length > 0) {
          <div class="alert-section-label">Network</div>
          <mat-accordion multi>
            @for (alert of networkAlerts(); track alert.title) {
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
        @if (lineAlerts().length > 0) {
          <div class="alert-section-label">Lines</div>
          <mat-accordion multi>
            @for (entry of lineAlerts(); track entry.line.id) {
              @for (alert of entry.alerts; track alert.title) {
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
  `,
  styles: `
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
      font-size: var(--m3-type-label-small);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--app-map-on-surface-muted);
      padding: 6px 4px 2px;
    }

    .alert-section-label:not(:first-child) {
      margin-top: 6px;
    }

    .alert-panel {
      --mat-expansion-container-background-color: var(--app-map-overlay-bg);
      --mat-expansion-container-shape: 8px;
      --mat-expansion-header-text-size: 13px;
      --mat-expansion-header-text-weight: 600;
      backdrop-filter: blur(8px);
      box-shadow: 0 1px 6px var(--app-map-shadow);
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
      border-radius: var(--app-radius-xs);
      font-size: var(--m3-type-label-small);
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
      font-size: var(--m3-type-label-medium);
      line-height: 1.5;
      color: var(--app-map-on-surface-variant);
    }
  `,
})
export class AlertOverlayComponent {
  networkAlerts = input.required<AlertMessage[]>();
  lineAlerts = input.required<VisibleLineAlert[]>();

  hasContent = computed(() => this.networkAlerts().length > 0 || this.lineAlerts().length > 0);
}
