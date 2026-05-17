import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { NotifyService } from '@core/services/notify.service';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmAndDelete, ConfirmAndDeleteDeps } from './confirm-and-delete';

describe('confirmAndDelete', () => {
  let deps: ConfirmAndDeleteDeps;
  let afterClosed$: Subject<boolean | undefined>;
  let notifySuccess: ReturnType<typeof vi.fn>;
  let notifyError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    afterClosed$ = new Subject();
    const dialogRef = {
      afterClosed: () => afterClosed$.asObservable(),
    } as unknown as MatDialogRef<unknown>;
    const dialog = { open: vi.fn().mockReturnValue(dialogRef) } as unknown as MatDialog;
    notifySuccess = vi.fn();
    notifyError = vi.fn();
    const notify = { success: notifySuccess, error: notifyError } as unknown as NotifyService;
    const transloco = {
      translate: vi.fn((key: string) => `t(${key})`),
    } as unknown as TranslocoService;
    deps = { dialog, transloco, notify };
  });

  it('runs the delete observable and notifies success when the user confirms', () => {
    const onSuccess = vi.fn();
    confirmAndDelete(deps, {
      titleKey: 'admin.x.delete.title',
      messageKey: 'admin.x.delete.message',
      successKey: 'admin.x.delete.success',
      errorKey: 'admin.x.delete.error',
      delete$: () => of(void 0),
      onSuccess,
    });

    afterClosed$.next(true);

    expect(onSuccess).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith('t(admin.x.delete.success)');
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('notifies error when the delete observable fails', () => {
    const onSuccess = vi.fn();
    confirmAndDelete(deps, {
      titleKey: 'admin.x.delete.title',
      messageKey: 'admin.x.delete.message',
      successKey: 'admin.x.delete.success',
      errorKey: 'admin.x.delete.error',
      delete$: () => throwError(() => new Error('boom')),
      onSuccess,
    });

    afterClosed$.next(true);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('does nothing when the user cancels', () => {
    const onSuccess = vi.fn();
    const delete$ = vi.fn().mockReturnValue(of(void 0));
    confirmAndDelete(deps, {
      titleKey: 'admin.x.delete.title',
      messageKey: 'admin.x.delete.message',
      successKey: 'admin.x.delete.success',
      errorKey: 'admin.x.delete.error',
      delete$,
      onSuccess,
    });

    afterClosed$.next(false);

    expect(delete$).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });
});
