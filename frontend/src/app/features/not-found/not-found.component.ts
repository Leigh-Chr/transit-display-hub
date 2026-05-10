import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="not-found" role="main">
      <img ngSrc="assets/logo.png" width="72" height="72" alt="" class="not-found-logo" aria-hidden="true">
      <h1>{{ 'notFound.title' | transloco }}</h1>
      <p>{{ 'notFound.description' | transloco }}</p>
      <div class="actions">
        <a mat-flat-button color="primary" routerLink="/map">
          <mat-icon>map</mat-icon>
          {{ 'map.title' | transloco }}
        </a>
        <a mat-stroked-button routerLink="/admin/dashboard">
          <mat-icon>dashboard</mat-icon>
          {{ 'admin.navigation.dashboard' | transloco }}
        </a>
      </div>
    </main>
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

    .not-found-logo {
      width: 72px;
      height: 72px;
      opacity: 0.5;
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

    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
  `,
})
export class NotFoundComponent {}
