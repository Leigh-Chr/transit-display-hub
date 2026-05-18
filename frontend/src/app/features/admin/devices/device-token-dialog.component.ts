import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

export interface DeviceTokenDialogData {
  token: string;
}

@Component({
  selector: 'app-device-token-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <h2 mat-dialog-title>{{ t('admin.devices.tokenTitle') }}</h2>
      <mat-dialog-content>
        <p class="token-instructions">{{ t('admin.devices.tokenInstructions') }}</p>

        <label class="field-label" for="device-url">{{ t('admin.devices.urlLabel') }}</label>
        <div
          id="device-url"
          class="token-display url-display"
          [class.not-copied]="!copied()"
          role="region"
        >{{ displayUrl() }}</div>

        <label class="field-label" for="device-token">{{ t('admin.devices.tokenLabel') }}</label>
        <div
          id="device-token"
          class="token-display"
          [attr.aria-label]="t('common.ariaLabel.deviceToken')"
          role="region"
        >{{ data.token }}</div>

        @if (!copied()) {
          <p class="warning-hint" role="status">
            <mat-icon aria-hidden="true">warning</mat-icon>
            {{ t('admin.devices.notCopiedWarning') }}
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button
          mat-stroked-button
          type="button"
          (click)="copyToken()"
        >
          <mat-icon>content_copy</mat-icon>
          {{ t('admin.devices.copyToken') }}
        </button>
        <button
          mat-flat-button
          color="primary"
          type="button"
          data-copy-button
          (click)="copyUrl()"
        >
          <mat-icon>content_copy</mat-icon>
          {{ t('admin.devices.copyUrl') }}
        </button>
        <button
          mat-stroked-button
          type="button"
          (click)="attemptClose()"
        >
          {{ copied() ? t('admin.common.done') : t('admin.devices.closeWithoutCopying') }}
        </button>
      </mat-dialog-actions>
    </ng-container>
  `,
  styles: `
    .token-instructions {
      color: var(--app-on-surface-variant);
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .field-label {
      display: block;
      font-size: var(--m3-type-label-medium);
      font-weight: 600;
      color: var(--app-on-surface-variant);
      margin: 12px 0 4px;
    }

    .token-display {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: var(--m3-type-body-small);
      background-color: var(--app-surface-variant);
      padding: 12px;
      border-radius: var(--app-radius-sm);
      word-break: break-all;
      user-select: all;
      border: 1px solid var(--app-outline);
      min-width: var(--app-dialog-min-width);
    }

    .url-display.not-copied {
      border-color: var(--app-warning, #c97a17);
      border-width: 2px;
    }

    .warning-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 16px 0 0;
      padding: 8px 12px;
      border-radius: var(--app-radius-sm);
      background: color-mix(in srgb, var(--app-warning, #c97a17) 12%, transparent);
      color: var(--app-warning, #c97a17);
      font-size: var(--m3-type-body-small);
      font-weight: 500;
    }

    .warning-hint mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
  `,
})
export class DeviceTokenDialogComponent {
  readonly dialogRef = inject(MatDialogRef<DeviceTokenDialogComponent>);
  readonly data = inject<DeviceTokenDialogData>(MAT_DIALOG_DATA);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  /** Becomes true once either copy action succeeds. Drives the warning-
   *  hint visibility and the "Close anyway" wording so the operator
   *  can't accidentally close the dialog and lose the only-shown-once
   *  token without an explicit acknowledgement. */
  readonly copied = signal(false);

  readonly displayUrl = computed(() => {
    // Built at click time would be more reactive, but the URL never
    // changes during the dialog lifetime — computed keeps the template
    // pure without rebuilding the string on every change-detection.
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/display?token=${this.data.token}`;
  });

  copyToken(): void {
    navigator.clipboard.writeText(this.data.token).then(
      () => {
        this.copied.set(true);
        this.notify.success(this.transloco.translate('admin.devices.tokenCopied'));
      },
      () => {
        this.notify.error(this.transloco.translate('admin.devices.tokenCopyFailed'));
      }
    );
  }

  copyUrl(): void {
    navigator.clipboard.writeText(this.displayUrl()).then(
      () => {
        this.copied.set(true);
        this.notify.success(this.transloco.translate('admin.devices.urlCopied'));
      },
      () => {
        this.notify.error(this.transloco.translate('admin.devices.urlCopyFailed'));
      }
    );
  }

  /** The "Done" button uses a regular close on the happy path but the
   *  "Close anyway" branch keeps an explicit click step so the operator
   *  can't dismiss the dialog with a misclick before they've copied. */
  attemptClose(): void {
    this.dialogRef.close();
  }
}
