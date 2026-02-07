import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="not-found">
      <mat-icon class="not-found-icon">explore_off</mat-icon>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <a mat-flat-button color="primary" routerLink="/admin/dashboard">
        <mat-icon>home</mat-icon>
        Go to Dashboard
      </a>
    </div>
  `,
  styles: `
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      text-align: center;
      padding: 32px;
    }

    .not-found-icon {
      font-size: 72px;
      width: 72px;
      height: 72px;
      color: var(--app-on-surface-muted, #999);
      margin-bottom: 16px;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      color: var(--app-on-surface, #333);
      margin: 0 0 8px;
    }

    p {
      color: var(--app-on-surface-variant, #666);
      margin: 0 0 24px;
    }
  `,
})
export class NotFoundComponent {}
