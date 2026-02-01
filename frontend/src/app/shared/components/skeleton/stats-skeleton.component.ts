import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SkeletonComponent } from './skeleton.component';

@Component({
  selector: 'app-stats-skeleton',
  standalone: true,
  imports: [MatCardModule, SkeletonComponent],
  template: `
    <div class="stats-grid">
      @for (i of [1, 2, 3]; track i) {
        <mat-card class="stat-card">
          <mat-card-content>
            <app-skeleton width="80px" height="36px" variant="text" />
            <app-skeleton width="100px" height="14px" variant="text" />
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: `
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 24px;
    }

    .stat-card mat-card-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `,
})
export class StatsSkeletonComponent {}
