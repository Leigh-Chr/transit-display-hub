import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SkeletonComponent } from './skeleton.component';

@Component({
  selector: 'app-card-skeleton',
  standalone: true,
  imports: [MatCardModule, SkeletonComponent],
  template: `
    <mat-card class="card-skeleton">
      <mat-card-content>
        @if (showIcon()) {
          <app-skeleton width="40px" height="40px" borderRadius="8px" />
        }
        <div class="content">
          <app-skeleton width="60%" height="24px" variant="text" />
          <app-skeleton width="40%" height="16px" variant="text" />
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .card-skeleton {
      border-radius: 12px;
    }

    mat-card-content {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `,
})
export class CardSkeletonComponent {
  readonly showIcon = input(false);
}
