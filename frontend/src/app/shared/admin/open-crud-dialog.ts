import { ComponentType } from '@angular/cdk/portal';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { NotifyService } from '@core/services/notify.service';
import { httpErrorMessage } from '../utils/http.utils';

export interface OpenCrudDialogDeps {
  dialog: MatDialog;
  transloco: TranslocoService;
  notify: NotifyService;
}

export interface OpenCrudDialogConfig<TData extends object, TRequest, TResult> {
  component: ComponentType<unknown>;
  /** Fields injected as the dialog's `data` alongside `submit` + `onError`. */
  data?: TData;
  width?: string;
  /** Translation key used as both the aria-label and (by convention) the
   *  dialog's title. */
  titleKey: string;
  /** Optional interpolation params for {@link titleKey} — used when the
   *  title embeds the entity name (e.g. "Edit stops of {{ name }}"). */
  titleArgs?: Record<string, unknown>;
  /** Translation key for the success snackbar — fires after the dialog
   *  closes with a truthy result. */
  successKey: string;
  /** Translation key for the fallback error snackbar (when the server
   *  response doesn't carry a localised message). */
  errorKey: string;
  /** The HTTP call that the dialog will invoke via its injected
   *  {@code submit} callback. */
  submitOp: (request: TRequest) => Observable<TResult>;
  /** Optional side-effect run on successful close — typically a list
   *  reload or a {@code resetToFirstPage()} call for "create" flows. */
  onSuccess?: (result: TResult) => void;
}

/**
 * Opens a CRUD dialog and wires the standard create/update flow:
 *
 *   1. Inject {@code submit} and {@code onError} into the dialog's data
 *      so the dialog body can stay focused on the form.
 *   2. After close, when the dialog returns a truthy result, run the
 *      caller's {@code onSuccess} (reload / reset) and toast a localised
 *      success message.
 *
 * Sister to {@link confirmAndDelete}: every admin list page used to
 * inline this open + afterClosed + reload pattern; centralising it keeps
 * width, aria-label, error handling and snackbar tone consistent.
 */
export function openCrudDialog<TData extends object, TRequest, TResult>(
  deps: OpenCrudDialogDeps,
  config: OpenCrudDialogConfig<TData, TRequest, TResult>,
): void {
  const ariaLabel = deps.transloco.translate(config.titleKey, config.titleArgs);
  const dialogConfig: MatDialogConfig = {
    data: {
      ...(config.data ?? {}),
      submit: config.submitOp,
      onError: (err: unknown) => {
        deps.notify.error(httpErrorMessage(err, deps.transloco.translate(config.errorKey)));
      },
    },
    ariaLabel,
  };
  if (config.width) {
    dialogConfig.width = config.width;
  }
  const dialogRef = deps.dialog.open(config.component, dialogConfig);
  dialogRef.afterClosed().subscribe((result: TResult | undefined) => {
    if (!result) {
      return;
    }
    config.onSuccess?.(result);
    deps.notify.success(deps.transloco.translate(config.successKey));
  });
}
