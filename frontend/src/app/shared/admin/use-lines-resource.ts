import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

import { LineService } from '@core/api/line.service';
import { NotifyService } from '@core/services/notify.service';
import { Line } from '@shared/models';

/**
 * Loads the full line catalogue once (typical dropdown / filter source)
 * and exposes it as a read-only signal. On HTTP error, raises a snackbar
 * keyed on {@code `${namespace}.loadLinesFailed`} so the four admin
 * pages that share this need stay distinguishable in the toast log.
 *
 * Must be called in an Angular injection context (component / directive
 * field initialiser or constructor) — relies on inject() for LineService,
 * NotifyService, TranslocoService, and DestroyRef.
 *
 * @param namespace Transloco namespace prefix for the error key. Pages
 *                  scope their own copies (e.g. `admin.messages`).
 */
export function useLinesResource(namespace: string): Signal<readonly Line[]> {
  const lineService = inject(LineService);
  const notify = inject(NotifyService);
  const transloco = inject(TranslocoService);
  const destroyRef = inject(DestroyRef);

  const lines = signal<readonly Line[]>([]);

  lineService
    .getAll()
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe({
      next: (data) => lines.set(data),
      error: () => notify.error(transloco.translate(`${namespace}.loadLinesFailed`)),
    });

  return lines;
}
