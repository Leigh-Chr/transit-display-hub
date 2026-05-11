import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
        <div class="token-display" aria-label="Device token" role="region">{{ data.token }}</div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button
          mat-flat-button
          color="primary"
          data-copy-button
          (click)="copyToken()"
        >
          <mat-icon>content_copy</mat-icon>
          {{ t('admin.devices.copyToken') }}
        </button>
        <button mat-stroked-button mat-dialog-close>
          {{ t('admin.common.done') }}
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

    .token-display {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 13px;
      background-color: var(--app-surface-variant);
      padding: 16px;
      border-radius: var(--app-radius-sm);
      word-break: break-all;
      margin-bottom: 8px;
      user-select: all;
      border: 1px solid var(--app-outline);
      min-width: var(--app-dialog-min-width);
    }
  `,
})
export class DeviceTokenDialogComponent {
  readonly dialogRef = inject(MatDialogRef<DeviceTokenDialogComponent>);
  readonly data = inject<DeviceTokenDialogData>(MAT_DIALOG_DATA);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  copyToken(): void {
    navigator.clipboard.writeText(this.data.token).then(
      () => {
        this.notify.success(this.transloco.translate('admin.devices.tokenCopied'));
      },
      () => {
        this.notify.error(this.transloco.translate('admin.devices.tokenCopyFailed'));
      }
    );
  }
}
