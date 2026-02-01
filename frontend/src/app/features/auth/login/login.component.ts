import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-neutral-100">
      <div class="card p-8 w-full max-w-md">
        <h1 class="text-2xl font-bold text-neutral-900 mb-6 text-center">Transit Display Hub</h1>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <div class="mb-4">
            <label for="username" class="form-label">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              [(ngModel)]="username"
              required
              class="form-input"
              [class.error]="error()"
            >
          </div>

          <div class="mb-6">
            <label for="password" class="form-label">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              [(ngModel)]="password"
              required
              class="form-input"
              [class.error]="error()"
            >
          </div>

          @if (error()) {
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-critical text-sm">
              {{ error() }}
            </div>
          }

          <button
            type="submit"
            class="btn btn-primary w-full"
            [disabled]="loading()"
          >
            @if (loading()) {
              Logging in...
            } @else {
              Login
            }
          </button>
        </form>

        <p class="mt-4 text-sm text-neutral-600 text-center">
          Default credentials: admin / admin123
        </p>
      </div>
    </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (!this.username || !this.password) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.login({ username: this.username, password: this.password }).subscribe({
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
      }
    });
  }
}
