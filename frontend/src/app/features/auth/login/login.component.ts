import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <main class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <h1 class="login-title">Transit Display Hub</h1>
        </mat-card-header>

        <mat-card-content>
          <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Username</mat-label>
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
              <mat-label>Password</mat-label>
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
              <div class="error-message">
                <mat-icon>error</mat-icon>
                {{ error() }}
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
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Login
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-footer>
          <p class="hint-text">Default credentials: admin / admin123</p>
        </mat-card-footer>
      </mat-card>
    </main>
  `,
  styles: `
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--app-surface) 0%, var(--app-surface-variant) 100%);
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 24px;
      border-radius: 16px;
    }

    mat-card-header {
      justify-content: center;
      margin-bottom: 32px;
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
      border-radius: 8px;
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
      border-radius: 8px;
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

  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.username || !this.password) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService
      .login({ username: this.username, password: this.password })
      .subscribe({
        next: () => {
          this.router.navigate(['/admin']);
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 401) {
            this.error.set('Invalid credentials');
          } else {
            this.error.set('An error occurred. Please try again.');
          }
        },
      });
  }
}
