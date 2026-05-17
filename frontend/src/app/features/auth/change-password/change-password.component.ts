import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';

/** Minimum new-password length — must stay in sync with the backend
 *  {@code ChangePasswordRequest.newPassword @Size(min)} constraint. */
const MIN_PASSWORD_LENGTH = 12;

@Component({
  selector: 'app-change-password',
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
    <main class="change-password-container" *transloco="let t">
      <mat-card class="change-password-card">
        <mat-card-header>
          <div class="change-password-brand">
            <img ngSrc="assets/logo.png" width="72" height="72"
                 [alt]="t('auth.login.logoAlt')" class="brand-logo" priority>
            <h1 class="change-password-title">{{ t('auth.changePassword.title') }}</h1>
            <p class="change-password-subtitle">{{ t('auth.changePassword.subtitle') }}</p>
          </div>
        </mat-card-header>

        <mat-card-content>
          <div class="must-change-notice" role="status">
            <mat-icon>info</mat-icon>
            {{ t('auth.changePassword.mustChangeNotice') }}
          </div>

          <form (ngSubmit)="onSubmit()" #form="ngForm">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ t('auth.changePassword.currentPassword') }}</mat-label>
              <mat-icon matPrefix>lock</mat-icon>
              <input
                matInput
                type="password"
                name="currentPassword"
                autocomplete="current-password"
                [(ngModel)]="currentPassword"
                required
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ t('auth.changePassword.newPassword') }}</mat-label>
              <mat-icon matPrefix>lock_reset</mat-icon>
              <input
                matInput
                type="password"
                name="newPassword"
                autocomplete="new-password"
                [(ngModel)]="newPassword"
                required
                [minlength]="MIN_PASSWORD_LENGTH"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ t('auth.changePassword.confirmPassword') }}</mat-label>
              <mat-icon matPrefix>lock_reset</mat-icon>
              <input
                matInput
                type="password"
                name="confirmPassword"
                autocomplete="new-password"
                [(ngModel)]="confirmPassword"
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
              [disabled]="loading() || !canSubmit()"
            >
              @if (loading()) {
                <mat-spinner diameter="20" [attr.aria-label]="t('auth.changePassword.loadingAriaLabel')"></mat-spinner>
              } @else {
                {{ t('auth.changePassword.submit') }}
              }
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .change-password-container {
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

    .change-password-card {
      width: 100%;
      max-width: 460px;
      padding: 24px;
      border-radius: var(--app-radius-lg);
    }

    mat-card-header {
      justify-content: center;
      margin-bottom: 24px;
    }

    .change-password-brand {
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

    .change-password-title {
      font-size: var(--m3-type-headline-medium);
      font-weight: 700;
      color: var(--app-on-surface);
      letter-spacing: -0.5px;
      margin: 0;
      text-align: center;
    }

    .change-password-subtitle {
      color: var(--app-on-surface-variant);
      font-size: var(--m3-type-body-medium);
      margin: 0;
      text-align: center;
    }

    .must-change-notice {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background-color: var(--app-info-container, rgba(0, 100, 200, 0.08));
      border-radius: var(--app-radius-sm);
      color: var(--app-on-surface);
      font-size: var(--m3-type-body-medium);
    }

    .full-width {
      width: 100%;
    }

    .submit-button {
      margin-top: 12px;
      height: 52px;
      font-size: var(--m3-type-body-large);
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
      font-size: var(--m3-type-body-medium);
      font-weight: 500;
    }

    .error-message mat-icon {
      font-size: var(--m3-type-headline-small);
      width: 20px;
      height: 20px;
      color: var(--app-critical);
    }
  `,
})
export class ChangePasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;

  // Plain fields drive ngModel two-way binding. We can't back them with
  // signals here because Material's [(ngModel)] writes into a property,
  // not a Signal setter — and ngModelChange would only fire on blur,
  // which would leave the submit button stale until the user tabs out.
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal<string | null>(null);

  /** Submit stays disabled until both fields are filled, the new password
   *  is long enough, and the confirmation matches. Plain method (not
   *  computed) so OnPush re-evaluates it on every change-detection pass —
   *  computed would never re-fire because the inputs are primitive fields
   *  that don't register as signal reads. */
  protected canSubmit(): boolean {
    return (
      this.currentPassword.length > 0 &&
      this.newPassword.length >= MIN_PASSWORD_LENGTH &&
      this.confirmPassword === this.newPassword
    );
  }

  onSubmit(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      return;
    }
    if (this.newPassword.length < MIN_PASSWORD_LENGTH) {
      this.error.set('auth.changePassword.error.passwordTooShort');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('auth.changePassword.error.passwordsDoNotMatch');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService
      .changePassword({
        currentPassword: this.currentPassword,
        newPassword: this.newPassword,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          const redirectUrl = this.authService.consumeRedirectUrl();
          void this.router.navigateByUrl(redirectUrl ?? '/admin');
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const httpErr = err as { status?: number };
          if (httpErr.status === 401) {
            this.error.set('auth.changePassword.error.invalidCurrentPassword');
          } else if (httpErr.status === 400) {
            this.error.set('auth.changePassword.error.passwordTooShort');
          } else {
            this.error.set('auth.changePassword.error.generic');
          }
        },
      });
  }
}
