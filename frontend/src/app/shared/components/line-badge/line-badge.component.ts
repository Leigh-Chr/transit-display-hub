import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Coloured GTFS line badge used in admin lists, dashboard cards, and
 * the lines page hero. The colour is GTFS-feed-driven so it has to be
 * applied as an inline style; everything else (padding, radius, font)
 * lives here.
 *
 * `size`:
 *   - `sm`  compact rows (line-index, popups)
 *   - `md`  default for admin lists, dashboard, devices, stops, etc.
 *   - `lg`  hero badge on the lines page (large coloured square)
 */
@Component({
  selector: 'app-line-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="line-badge"
      [class.sm]="size() === 'sm'"
      [class.lg]="size() === 'lg'"
      [style.backgroundColor]="color()"
      [style.color]="textColor()"
    >{{ code() }}</span>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .line-badge {
      display: inline-block;
      min-width: 36px;
      padding: 4px 10px;
      border-radius: var(--app-line-badge-radius);
      font-size: var(--m3-type-label-medium);
      font-weight: 600;
      text-align: center;
    }

    .line-badge.sm {
      padding: 2px 8px;
      font-size: var(--m3-type-label-small);
    }

    .line-badge.lg {
      padding: 8px 18px;
      font-size: var(--m3-type-title-large);
      font-weight: 700;
      letter-spacing: 0.5px;
    }
  `,
})
export class LineBadgeComponent {
  readonly code = input.required<string>();
  readonly color = input.required<string>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  // Defaults to white because GTFS palettes are predominantly dark.
  // Pass the result of {@link lineTextColor} (or the line's own
  // {@code textColor} field) when the colour might be light enough
  // to need dark text — see line palettes that store both.
  readonly textColor = input<string>('white');
}
