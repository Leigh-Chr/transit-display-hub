import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <div
      class="skeleton"
      [style.width]="width()"
      [style.height]="height()"
      [style.borderRadius]="borderRadius()"
      [class.skeleton-circle]="variant() === 'circle'"
      [class.skeleton-text]="variant() === 'text'"
    ></div>
  `,
  styles: `
    .skeleton {
      background: linear-gradient(
        90deg,
        var(--app-surface-variant) 25%,
        var(--app-surface-container-high) 50%,
        var(--app-surface-variant) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    .skeleton-circle {
      border-radius: 50%;
    }

    .skeleton-text {
      border-radius: var(--app-radius-xs);
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `,
})
export class SkeletonComponent {
  readonly width = input('100%');
  readonly height = input('20px');
  readonly borderRadius = input('4px');
  readonly variant = input<'rect' | 'circle' | 'text'>('rect');
}
