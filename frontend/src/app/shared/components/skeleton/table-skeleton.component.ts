import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SkeletonComponent } from './skeleton.component';

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  imports: [MatCardModule, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="table-skeleton">
      <!-- Header row -->
      <div class="skeleton-header">
        @for (col of columns(); track $index) {
          <app-skeleton [width]="col.width || '100px'" height="14px" variant="text" />
        }
      </div>

      <!-- Data rows -->
      @for (row of rowsArray; track row) {
        <div class="skeleton-row">
          @for (col of columns(); track $index) {
            <app-skeleton
              [width]="col.width || '100px'"
              [height]="col.height || '20px'"
              [borderRadius]="col.circle ? '50%' : '4px'"
            />
          }
        </div>
      }
    </mat-card>
  `,
  styles: `
    .table-skeleton {
      padding: 0;
      overflow: hidden;
      border-radius: var(--app-radius-md);
    }

    .skeleton-header {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 16px 24px;
      background-color: var(--app-surface-variant);
    }

    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--app-outline);
    }

    .skeleton-row:last-child {
      border-bottom: none;
    }
  `,
})
export class TableSkeletonComponent {
  readonly rows = input(5);
  readonly columns = input<{ width?: string; height?: string; circle?: boolean }[]>([
    { width: '60px' },
    { width: '150px' },
    { width: '100px' },
    { width: '80px' },
  ]);

  get rowsArray(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }
}
