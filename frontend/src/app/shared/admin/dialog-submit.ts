import { WritableSignal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';

/**
 * Keeps a save dialog open until the HTTP request resolves. The button
 * stays disabled with an inline spinner during the call so users can't
 * double-submit, and the dialog only closes once the server confirms.
 * On error the dialog stays open and the form values survive — perfect
 * for "validation failed, fix and retry" flows.
 *
 * Convention: parents push their HTTP call via `data.submit`, and the
 * dialog wires this helper inside its own `save()` method.
 */
export function runDialogSubmit<TResult>(
  submitting: WritableSignal<boolean>,
  submit: () => Observable<TResult>,
  dialogRef: MatDialogRef<unknown, TResult | undefined>,
  onError?: (err: unknown) => void,
): void {
  if (submitting()) {
    return;
  }
  submitting.set(true);
  submit().subscribe({
    next: (result) => dialogRef.close(result),
    error: (err: unknown) => {
      submitting.set(false);
      onError?.(err);
    },
  });
}
