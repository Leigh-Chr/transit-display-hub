import { ChangeDetectionStrategy, Component, inject, isDevMode, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NgOptimizedImage,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-container" *transloco="let t">
      <mat-card class="login-card">
        <mat-card-header>
          <div class="login-brand">
            <img ngSrc="assets/logo.png" width="72" height="72" [alt]="t('auth.login.logoAlt')" class="brand-logo" priority>
            <h1 class="login-title">{{ t('common.appName') }}</h1>
          </div>
        </mat-card-header>

        <mat-card-content>
          <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ t('auth.login.usernameLabel') }}</mat-label>
              <mat-icon matPrefix>person</mat-icon>
              <input
                matInput
                type="text"
                name="username"
                [(ngModel)]="username"
                required
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ t('auth.login.passwordLabel') }}</mat-label>
              <mat-icon matPrefix>lock</mat-icon>
              <input
                matInput
                type="password"
                name="password"
                [(ngModel)]="password"
                required
              />
            </mat-form-field>

            @if (error()) {
              <div class="error-message" role="alert" aria-live="assertive">
                <mat-icon>error</mat-icon>
                {{ t(error()!) }}
              </div>
            }

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="full-width submit-button"
              [disabled]="loading()"
            >
              @if (loading()) {
                <mat-spinner diameter="20" [attr.aria-label]="t('auth.login.loadingAriaLabel')"></mat-spinner>
              } @else {
                {{ t('auth.login.submit') }}
              }
            </button>
          </form>
        </mat-card-content>

        @if (devMode) {
          <mat-card-footer>
            <p class="hint-text">{{ t('auth.login.devHint') }}</p>
          </mat-card-footer>
        }
      </mat-card>
    </main>
  `,
  styles: `
    .login-container {
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

    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 24px;
      border-radius: var(--app-radius-lg);
    }

    mat-card-header {
      justify-content: center;
      margin-bottom: 32px;
    }

    .login-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      width: 100%;
    }

    .brand-logo {
      width: 72px;
      height: 72px;
    }

    .login-title {
      font-size: 26px;
      font-weight: 700;
      color: var(--app-on-surface);
      letter-spacing: -0.5px;
      margin: 0;
      text-align: center;
      width: 100%;
    }

    .full-width {
      width: 100%;
    }

    .submit-button {
      margin-top: 24px;
      height: 52px;
      font-size: 16px;
      font-weight: 500;
      border-radius: var(--app-radius-sm);
    }

    .submit-button mat-spinner {
      display: inline-block;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      margin-bottom: 16px;
      background-color: var(--app-critical-container);
      border-radius: var(--app-radius-sm);
      color: var(--app-on-critical-container);
      font-size: 14px;
      font-weight: 500;
    }

    .error-message mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--app-critical);
    }

    .hint-text {
      text-align: center;
      color: var(--app-on-surface-variant);
      font-size: 13px;
      margin: 20px 0 0;
    }
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected devMode = isDevMode();

  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.username || !this.password) {return;}

    this.loading.set(true);
    this.error.set(null);

    this.authService
      .login({ username: this.username, password: this.password })
      .subscribe({
        next: () => {
          const redirectUrl = this.authService.consumeRedirectUrl();
          void this.router.navigateByUrl(redirectUrl ?? '/admin');
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const httpErr = err as { status?: number };
          if (httpErr.status === 401) {
            this.error.set('auth.login.error.invalidCredentials');
          } else if (httpErr.status === 429) {
            this.error.set('auth.login.error.tooManyAttempts');
          } else {
            this.error.set('auth.login.error.generic');
          }
        },
      });
  }
}
