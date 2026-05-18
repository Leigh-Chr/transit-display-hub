import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { MessageSeverity, NetworkLine } from '@shared/models';
import { lineTextColor } from '@shared/utils/color.utils';

@Component({
  selector: 'app-line-filter-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="line-filters" [attr.aria-label]="transloco.translate('map.lineFilter.selectAria')">
      <button
        class="filter-chip all-chip"
        [class.active]="visibleLineCodes().length === lines().length"
        (click)="toggleAll.emit()"
      >{{ transloco.translate('map.lineFilter.all') }}</button>
      @for (line of lines(); track line.id) {
        <button
          class="filter-chip"
          [class.active]="visibleSet().has(line.code)"
          [style.--chip-color]="line.color"
          [style.--chip-text]="lineTextColor(line)"
          [attr.title]="lineChipTitle(line.code)"
          (click)="lineToggle.emit(line.code)"
          (dblclick)="focusLine.emit(line.code)"
        >{{ line.code }}@if (alertSeverityFor(line.id); as sev) {<span class="chip-alert-dot" [class]="'chip-alert-dot-' + sev.toLowerCase()"></span>}</button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .line-filters {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      background: var(--app-map-surface-variant);
      border-bottom: 1px solid var(--app-map-outline-subtle);
      flex-wrap: wrap;
      align-items: center;
    }

    .filter-chip {
      position: relative;
      padding: 6px 14px;
      border: 2px solid var(--chip-color, var(--app-map-chip-inactive));
      background: var(--app-map-surface);
      color: var(--chip-color, var(--app-map-chip-inactive));
      font-weight: 700;
      font-size: var(--m3-type-body-small);
      border-radius: var(--app-radius-pill);
      cursor: pointer;
      transition: all var(--m3-duration-short3) var(--m3-easing-standard);
      user-select: none;
    }

    .filter-chip:hover {
      opacity: 0.85;
    }

    .filter-chip.active {
      background: var(--chip-color, var(--app-map-chip-inactive));
      color: var(--chip-text, white);
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
      border: 1.5px solid var(--app-map-surface);
    }

    .chip-alert-dot-critical { background: var(--app-critical); }
    .chip-alert-dot-warning { background: var(--app-warning); }
    .chip-alert-dot-info { background: var(--app-info); }

    .all-chip {
      --chip-color: var(--app-map-chip-inactive);
    }

    :host-context(.dark-theme) {
      .chip-alert-dot {
        border-color: var(--app-map-surface-container);
      }

      .line-filters {
        background: var(--app-map-surface-container);
        border-bottom-color: var(--app-map-surface-container-high);
      }

      .filter-chip {
        background: var(--app-map-surface-variant);
      }
    }

    @media (max-width: 600px) {
      .line-filters {
        padding: 8px 12px;
        gap: 6px;
        flex-wrap: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
      }

      .line-filters::-webkit-scrollbar {
        height: 4px;
      }

      .line-filters::-webkit-scrollbar-thumb {
        background: var(--app-map-outline);
        border-radius: 2px;
      }

      .filter-chip {
        padding: 5px 10px;
        font-size: var(--m3-type-label-medium);
        flex-shrink: 0;
      }
    }
  `,
})
export class LineFilterChipsComponent {
  lines = input.required<NetworkLine[]>();
  visibleLineCodes = input.required<string[]>();
  /** lineId -> highest active alert severity, used for the dot indicator. */
  alertSeverityByLineId = input<Map<string, MessageSeverity>>(new Map());

  lineToggle = output<string>();
  toggleAll = output();
  focusLine = output<string>();

  // Public so the template can call transloco.translate() directly without
  // having to wrap the whole element in *transloco — keeps the host
  // attribute available for the read.
  readonly transloco = inject(TranslocoService);

  visibleSet = computed(() => new Set(this.visibleLineCodes()));

  alertSeverityFor(lineId: string): MessageSeverity | null {
    return this.alertSeverityByLineId().get(lineId) ?? null;
  }

  lineChipTitle(code: string): string {
    return this.transloco.translate('map.lineFilter.chipTitle', { code });
  }

  readonly lineTextColor = lineTextColor;
}
