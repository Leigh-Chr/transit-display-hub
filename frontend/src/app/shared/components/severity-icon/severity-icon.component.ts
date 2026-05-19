import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { MessageSeverity } from '@shared/models';

/**
 * Solid square icon coloured by severity (CRITICAL → red, WARNING →
 * amber, INFO → blue). Used twice: the messages admin card (md) and
 * the dashboard recent-messages list (sm). Keeps the icon mapping +
 * background tokens in one file so the two surfaces don't drift.
 */
@Component({
  selector: 'app-severity-icon',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="severity-icon"
      [class]="'tone-' + severity().toLowerCase()"
      [class.size-sm]="size() === 'sm'"
    >
      <mat-icon aria-hidden="true">{{ iconName() }}</mat-icon>
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .severity-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--app-radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .severity-icon.size-sm {
      width: 36px;
      height: 36px;
      border-radius: var(--app-radius-sm);
    }

    .severity-icon mat-icon {
      color: white;
    }

    .severity-icon.size-sm mat-icon {
      font-size: var(--m3-type-headline-small);
      width: 20px;
      height: 20px;
    }

    .tone-critical {
      background-color: var(--app-critical);
    }

    .tone-warning {
      background-color: var(--app-warning);
    }

    .tone-info {
      background-color: var(--app-info);
    }
  `,
})
export class SeverityIconComponent {
  readonly severity = input.required<MessageSeverity>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly iconName = computed(() => {
    switch (this.severity()) {
      case 'CRITICAL':
        return 'error';
      case 'WARNING':
        return 'warning';
      default:
        return 'info';
    }
  });
}
