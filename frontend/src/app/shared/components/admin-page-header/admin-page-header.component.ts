import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-admin-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header" [class.size-medium]="size() === 'medium'">
      <div class="page-header-text">
        <h1 class="page-title">{{ title() }}</h1>
        @if (subtitle(); as st) {
          <p class="page-subtitle">{{ st }}</p>
        }
      </div>
      <div class="page-actions">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }

    .page-header.size-medium {
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .page-header-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .page-title {
      font-size: var(--m3-type-headline-large);
      font-weight: 700;
      color: var(--app-on-surface);
      margin: 0;
      letter-spacing: -0.5px;
    }

    .size-medium .page-title {
      font-size: var(--m3-type-headline-medium);
      font-weight: 600;
      letter-spacing: 0;
    }

    .page-subtitle {
      margin: 0;
      color: var(--app-on-surface-variant);
      font-size: var(--m3-type-body-medium);
    }

    .page-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .page-actions:empty {
      display: none;
    }
  `,
})
export class AdminPageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly size = input<'large' | 'medium'>('large');
}
