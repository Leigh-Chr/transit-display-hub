import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'critical' | 'info';

/**
 * Pill-shaped badge used for status / severity / role tags across the
 * admin (devices ONLINE/OFFLINE, users role + enabled, messages
 * severity + active/inactive, import-audit error/warning/clean counts).
 *
 * `tone` maps to the design system's *-container palette so the
 * badge always reads on its own background regardless of theme.
 *
 * Content goes through `ng-content` so callers can mix an icon with
 * the label: `<app-status-badge tone="critical"><mat-icon>error</mat-icon>
 * Errors: 3</app-status-badge>`.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="status-badge"
      [class]="'tone-' + tone()"
      [class.size-sm]="size() === 'sm'"
      [class.uppercase]="uppercase()"
    >
      <ng-content />
    </span>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      border-radius: var(--app-line-badge-radius);
      font-size: var(--m3-type-label-medium);
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .status-badge.size-sm {
      padding: 2px 8px;
      font-size: var(--m3-type-label-small);
    }

    .status-badge.uppercase {
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tone-neutral {
      background-color: var(--app-surface-container-high);
      color: var(--app-on-surface-variant);
    }

    .tone-success {
      background-color: var(--app-success-container);
      color: var(--app-on-success-container);
    }

    .tone-warning {
      background-color: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }

    .tone-critical {
      background-color: var(--app-critical-container);
      color: var(--app-on-critical-container);
    }

    .tone-info {
      background-color: var(--app-info-container);
      color: var(--app-on-info-container);
    }

    .status-badge ::ng-deep mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      line-height: 16px;
    }
  `,
})
export class StatusBadgeComponent {
  readonly tone = input<StatusBadgeTone>('neutral');
  readonly size = input<'sm' | 'md'>('md');
  readonly uppercase = input(false);
}
