import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoDirective } from '@jsverse/transloco';
import { Line, Stop, RegisterDeviceRequest } from '@shared/models';
import { StopService } from '@core/api/stop.service';

export interface DeviceDialogData {
  lines: Line[];
}

interface DeviceForm {
  lineId: string;
  stopId: string;
}

@Component({
  selector: 'app-device-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <h2 mat-dialog-title>{{ t('admin.devices.dialog.title') }}</h2>
      <mat-dialog-content>
        <form #deviceForm="ngForm" class="form-container">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ t('admin.devices.dialog.fieldLine') }}</mat-label>
            <mat-select
              [(ngModel)]="form.lineId"
              name="lineId"
              required
              (selectionChange)="onLineChange()"
            >
              @for (line of data.lines; track line.id) {
                <mat-option [value]="line.id">
                  {{ line.code }} - {{ line.name }}
                </mat-option>
              }
            </mat-select>
            <mat-error>{{ t('admin.devices.dialog.fieldLineRequired') }}</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ t('admin.devices.dialog.fieldStop') }}</mat-label>
            <mat-select
              [(ngModel)]="form.stopId"
              name="stopId"
              required
              [disabled]="!form.lineId"
            >
              @for (stop of stops(); track stop.id) {
                <mat-option [value]="stop.id">{{ stop.name }}</mat-option>
              }
            </mat-select>
            @if (!form.lineId) {
              <mat-hint>{{ t('admin.devices.dialog.fieldStopHint') }}</mat-hint>
            }
            <mat-error>{{ t('admin.devices.dialog.fieldStopRequired') }}</mat-error>
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ t('common.cancel') }}</button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="!deviceForm.valid"
          (click)="save()"
        >
          {{ t('admin.devices.dialog.actionRegister') }}
        </button>
      </mat-dialog-actions>
    </ng-container>
  `,
  styles: `
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: var(--app-dialog-min-width);
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }
  `,
})
export class DeviceDialogComponent {
  private readonly stopService = inject(StopService);
  readonly dialogRef = inject(MatDialogRef<DeviceDialogComponent>);
  readonly data = inject<DeviceDialogData>(MAT_DIALOG_DATA);

  stops = signal<Stop[]>([]);

  form: DeviceForm = {
    lineId: '',
    stopId: '',
  };

  onLineChange(): void {
    this.form.stopId = '';
    if (this.form.lineId) {
      this.stopService.getAll(this.form.lineId).subscribe((stops) => this.stops.set(stops));
    } else {
      this.stops.set([]);
    }
  }

  save(): void {
    const request: RegisterDeviceRequest = {
      stopId: this.form.stopId,
    };
    this.dialogRef.close(request);
  }
}
