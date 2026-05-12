import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { SNACKBAR_DURATIONS } from '../../shared/utils/snackbar.constants';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  success(message: string): void {
    this.snackBar.open(message, this.transloco.translate('common.ok'), {
      duration: SNACKBAR_DURATIONS.success,
      panelClass: 'success-snackbar',
    });
  }

  info(message: string): void {
    this.snackBar.open(message, this.transloco.translate('common.ok'), {
      duration: SNACKBAR_DURATIONS.info,
      panelClass: 'info-snackbar',
    });
  }

  warn(message: string): void {
    this.snackBar.open(message, this.transloco.translate('common.ok'), {
      duration: SNACKBAR_DURATIONS.warning,
      panelClass: 'warning-snackbar',
    });
  }

  error(message: string, opts?: { retryable?: boolean }): void {
    const action = this.transloco.translate(opts?.retryable ? 'common.retry' : 'common.ok');
    this.snackBar.open(message, action, {
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
      .open(message, this.transloco.translate('common.retry'), {
        duration: SNACKBAR_DURATIONS.retryable,
        panelClass: 'error-snackbar',
      })
      .onAction();
  }
}
