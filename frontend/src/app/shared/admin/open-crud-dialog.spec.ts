import { TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import {
  MatDialog,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotifyService } from '@core/services/notify.service';
import { openCrudDialog } from './open-crud-dialog';

interface FakeDialogData {
  someExtra?: string;
  count?: number;
  submit: (req: unknown) => unknown;
  onError: (err: unknown) => void;
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button (click)="onSubmit()">submit</button>`,
})
class FakeDialogComponent {
  readonly data = inject<FakeDialogData>(MAT_DIALOG_DATA);
  onSubmit(): void {
    /* exercised through the helper's data.submit + onError plumbing */
  }
}

function buildDeps(overrides: { translateImpl?: (k: string) => string } = {}): {
  dialog: MatDialog;
  transloco: TranslocoService;
  notify: NotifyService;
  notifySuccess: ReturnType<typeof vi.fn>;
  notifyError: ReturnType<typeof vi.fn>;
} {
  const translateImpl = overrides.translateImpl ?? ((key: string): string => `t(${key})`);
  const transloco = { translate: vi.fn(translateImpl) } as unknown as TranslocoService;
  const notifySuccess = vi.fn();
  const notifyError = vi.fn();
  const notify = { success: notifySuccess, error: notifyError } as unknown as NotifyService;
  const dialog = TestBed.inject(MatDialog);
  return { dialog, transloco, notify, notifySuccess, notifyError };
}

describe('openCrudDialog', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MatDialogModule, FakeDialogComponent] });
  });

  it('runs onSuccess and notifies when the dialog closes with a truthy result', async () => {
    const deps = buildDeps();
    const onSuccess = vi.fn();

    openCrudDialog<object, string, { id: string }>(deps, {
      component: FakeDialogComponent,
      titleKey: 'feature.title',
      successKey: 'feature.success',
      errorKey: 'feature.error',
      submitOp: (req) => of({ id: req }),
      onSuccess,
    });

    const ref = deps.dialog.openDialogs.at(-1);
    expect(ref).toBeTruthy();
    const closed = firstValueFrom(ref!.afterClosed());
    ref?.close({ id: '42' });
    await closed;

    expect(onSuccess).toHaveBeenCalledWith({ id: '42' });
    expect(deps.notifySuccess).toHaveBeenCalledWith('t(feature.success)');
  });

  it('does nothing when the dialog closes with no result (cancel)', async () => {
    const deps = buildDeps();
    const onSuccess = vi.fn();

    openCrudDialog<object, undefined, undefined>(deps, {
      component: FakeDialogComponent,
      titleKey: 'k',
      successKey: 'k',
      errorKey: 'k',
      submitOp: () => of(undefined),
      onSuccess,
    });

    const ref = deps.dialog.openDialogs.at(-1);
    const closed = firstValueFrom(ref!.afterClosed());
    ref?.close(undefined);
    await closed;

    expect(onSuccess).not.toHaveBeenCalled();
    expect(deps.notifySuccess).not.toHaveBeenCalled();
  });

  it('exposes a working onError callback through the injected data', () => {
    const deps = buildDeps();

    openCrudDialog<object, undefined, undefined>(deps, {
      component: FakeDialogComponent,
      titleKey: 'k',
      successKey: 'k',
      errorKey: 'feature.fallbackError',
      submitOp: () => of(undefined),
    });

    const ref = deps.dialog.openDialogs.at(-1);
    const instance = ref?.componentInstance as FakeDialogComponent;
    instance.data.onError({ status: 500 });

    expect(deps.notifyError).toHaveBeenCalledTimes(1);
    const firstCallArgs = deps.notifyError.mock.calls[0] as [string];
    expect(firstCallArgs[0]).toContain('t(feature.fallbackError)');
  });

  it('forwards extra `data` fields alongside submit + onError', () => {
    const deps = buildDeps();

    openCrudDialog<{ someExtra: string; count: number }, undefined, undefined>(deps, {
      component: FakeDialogComponent,
      data: { someExtra: 'value', count: 3 },
      titleKey: 'k',
      successKey: 'k',
      errorKey: 'k',
      submitOp: () => of(undefined),
    });

    const ref = deps.dialog.openDialogs.at(-1);
    const instance = ref?.componentInstance as FakeDialogComponent;
    expect(instance.data.someExtra).toBe('value');
    expect(instance.data.count).toBe(3);
    expect(typeof instance.data.submit).toBe('function');
    expect(typeof instance.data.onError).toBe('function');
  });
});
