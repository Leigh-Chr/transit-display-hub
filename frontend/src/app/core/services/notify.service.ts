import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { SNACKBAR_DURATIONS } from '../../shared/utils/snackbar.constants';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: SNACKBAR_DURATIONS.success,
      panelClass: 'success-snackbar',
    });
  }

  info(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: SNACKBAR_DURATIONS.info,
      panelClass: 'info-snackbar',
    });
  }

  warn(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: SNACKBAR_DURATIONS.warning,
      panelClass: 'warning-snackbar',
    });
  }

  error(message: string, opts?: { retryable?: boolean }): void {
    this.snackBar.open(message, opts?.retryable ? 'Retry' : 'OK', {
      duration: opts?.retryable ? SNACKBAR_DURATIONS.retryable : SNACKBAR_DURATIONS.error,
      panelClass: 'error-snackbar',
    });
  }

  /**
   * Shows a retryable error snackbar and returns an Observable that emits once
   * when the user clicks the action button (typically "Retry").
   * Use this when the caller needs to subscribe to the retry action.
   */
  errorRetryable(message: string): Observable<void> {
    return this.snackBar
      .open(message, 'Retry', {
        duration: SNACKBAR_DURATIONS.retryable,
        panelClass: 'error-snackbar',
      })
      .onAction();
  }
}
