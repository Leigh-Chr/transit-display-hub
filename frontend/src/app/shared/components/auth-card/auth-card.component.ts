import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

/**
 * Centred auth surface used by the login + change-password screens.
 * Owns the full-height gradient background, the centred card, and
 * the brand header (logo + title + optional subtitle).
 *
 * Callers project the <form> and (optionally) a footer node via the
 * default and `footer` slots. Localised strings stay in the caller's
 * template so this component remains Transloco-agnostic.
 */
@Component({
  selector: 'app-auth-card',
  standalone: true,
  imports: [NgOptimizedImage, MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <div class="auth-brand">
            <img
              ngSrc="assets/logo.png"
              width="72"
              height="72"
              [alt]="logoAlt()"
              class="brand-logo"
              priority
            />
            <h1 class="auth-title">{{ title() }}</h1>
            @if (subtitle(); as st) {
              <p class="auth-subtitle">{{ st }}</p>
            }
          </div>
        </mat-card-header>

        <mat-card-content>
          <ng-content />
        </mat-card-content>

        <mat-card-footer>
          <ng-content select="[footer]" />
        </mat-card-footer>
      </mat-card>
    </main>
  `,
  styles: `
    :host {
      display: block;
    }

    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(
        135deg,
        var(--app-auth-bg-from) 0%,
        var(--app-auth-bg-via) 50%,
        var(--app-auth-bg-to) 100%
      );
    }

    .auth-card {
      width: 100%;
      max-width: 460px;
      padding: 24px;
      border-radius: var(--app-radius-lg);
    }

    mat-card-header {
      justify-content: center;
      margin-bottom: 24px;
    }

    .auth-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .brand-logo {
      width: 72px;
      height: 72px;
    }

    .auth-title {
      font-size: var(--m3-type-headline-medium);
      font-weight: 700;
      color: var(--app-on-surface);
      letter-spacing: -0.5px;
      margin: 0;
      text-align: center;
      width: 100%;
    }

    .auth-subtitle {
      color: var(--app-on-surface-variant);
      font-size: var(--m3-type-body-medium);
      margin: 0;
      text-align: center;
    }

    mat-card-footer:empty {
      display: none;
    }
  `,
})
export class AuthCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly logoAlt = input.required<string>();
}
