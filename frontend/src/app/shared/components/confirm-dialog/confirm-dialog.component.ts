import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'warn';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  // role="alertdialog" signals to assistive tech that this dialog requires
  // immediate attention (a destructive action) and should be announced
  // automatically, unlike a generic dialog which may be announced lazily.
  host: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-dialog-title' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title id="confirm-dialog-title">{{ data.title }}</h2>
    <mat-dialog-content aria-describedby="confirm-dialog-title">
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        {{ data.cancelText || 'Cancel' }}
      </button>
      <button
        mat-flat-button
        [color]="data.confirmColor || 'primary'"
        [mat-dialog-close]="true"
      >
        {{ data.confirmText || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content p {
      margin: 0;
      color: var(--app-on-surface-variant);
      line-height: 1.6;
    }
  `,
})
export class ConfirmDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
