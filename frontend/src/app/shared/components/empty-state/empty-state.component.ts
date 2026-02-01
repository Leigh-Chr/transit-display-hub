import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="empty-state">
      <div class="empty-icon" [class]="iconColor()">
        <mat-icon>{{ icon() }}</mat-icon>
      </div>
      <h3 class="empty-title">{{ title() }}</h3>
      @if (description()) {
        <p class="empty-description">{{ description() }}</p>
      }
      @if (actionLabel()) {
        <button mat-flat-button color="primary" (click)="action.emit()">
          @if (actionIcon()) {
            <mat-icon>{{ actionIcon() }}</mat-icon>
          }
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
    }

    .empty-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      background-color: var(--app-surface-variant);
    }

    .empty-icon mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--app-on-surface-variant);
    }

    .empty-icon.primary {
      background-color: var(--mat-sys-primary-container, #e3f2fd);
    }

    .empty-icon.primary mat-icon {
      color: var(--mat-sys-on-primary-container, #1565c0);
    }

    .empty-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 600;
      color: var(--app-on-surface);
    }

    .empty-description {
      margin: 0 0 20px;
      color: var(--app-on-surface-variant);
      max-width: 400px;
      line-height: 1.5;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly iconColor = input<'default' | 'primary'>('default');
  readonly title = input('No items found');
  readonly description = input<string | undefined>(undefined);
  readonly actionLabel = input<string | undefined>(undefined);
  readonly actionIcon = input<string | undefined>(undefined);
  readonly action = output<void>();
}
