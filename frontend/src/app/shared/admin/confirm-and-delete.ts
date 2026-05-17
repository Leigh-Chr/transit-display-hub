import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { NotifyService } from '@core/services/notify.service';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';
import { httpErrorMessage } from '../utils/http.utils';

export interface ConfirmAndDeleteDeps {
  dialog: MatDialog;
  transloco: TranslocoService;
  notify: NotifyService;
}

export interface ConfirmAndDeleteConfig {
  /** Translation key for the dialog title and the aria-label. */
  titleKey: string;
  /** Translation key for the body. */
  messageKey: string;
  /** Optional interpolation params for {@link messageKey}. */
  messageArgs?: Record<string, unknown>;
  /** Translation key for the success snackbar. */
  successKey: string;
  /** Translation key for the fallback error snackbar (when the
   *  server's i18n error message can't be extracted). */
  errorKey: string;
  /** Lazy factory so the HTTP call only fires when the user confirms. */
  delete$: () => Observable<void>;
  /** Side-effect ran after a successful delete — typically a list reload. */
  onSuccess: () => void;
}

/**
 * Opens a confirm dialog and runs the supplied delete observable when
 * the user accepts. Centralises the open → confirm → delete → notify
 * flow shared by every admin list page so a tweak to the snackbar tone
 * or the dialog buttons stays in one file.
 */
export function confirmAndDelete(deps: ConfirmAndDeleteDeps, config: ConfirmAndDeleteConfig): void {
  const title = deps.transloco.translate(config.titleKey);
  const dialogRef = deps.dialog.open(ConfirmDialogComponent, {
    data: {
      title,
      message: deps.transloco.translate(config.messageKey, config.messageArgs),
      confirmText: deps.transloco.translate('common.delete'),
      cancelText: deps.transloco.translate('common.cancel'),
      confirmColor: 'warn',
    },
    ariaLabel: title,
  });

  dialogRef.afterClosed().subscribe((confirmed) => {
    if (!confirmed) {
      return;
    }
    config.delete$().subscribe({
      next: () => {
        config.onSuccess();
        deps.notify.success(deps.transloco.translate(config.successKey));
      },
      error: (err: unknown) => {
        deps.notify.error(httpErrorMessage(err, deps.transloco.translate(config.errorKey)));
      },
    });
  });
}
