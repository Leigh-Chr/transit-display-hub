import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { NotifyService } from '@core/services/notify.service';
import { AuthService } from '@core/auth/auth.service';
import { AuthCardComponent } from '@shared/components/auth-card/auth-card.component';

/** Minimum new-password length — must stay in sync with the backend
 *  {@code ChangePasswordRequest.newPassword @Size(min)} constraint. */
const MIN_PASSWORD_LENGTH = 12;

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    AuthCardComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-auth-card
        [title]="t('auth.changePassword.title')"
        [subtitle]="t('auth.changePassword.subtitle')"
        [logoAlt]="t('auth.login.logoAlt')"
      >
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
      </app-auth-card>
    </ng-container>
  `,
  styles: `
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
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

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
          this.notify.success(this.transloco.translate('auth.changePassword.success'));
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
