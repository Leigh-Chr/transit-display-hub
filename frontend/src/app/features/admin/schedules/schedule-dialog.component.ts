import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TimedEntry, CreateTimedEntryRequest, LineInfo } from '@shared/models';

export interface ScheduleDialogData {
  entry?: TimedEntry;
  lines: LineInfo[];
}

@Component({
  selector: 'app-schedule-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.entry ? 'Edit Schedule Entry' : 'New Schedule Entry' }}
    </h2>
    <mat-dialog-content>
      <form #scheduleForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Line</mat-label>
          <mat-select
            [(ngModel)]="form.lineId"
            name="lineId"
            required
          >
            @for (line of data.lines; track line.id) {
              <mat-option [value]="line.id">
                <span class="line-option">
                  <span class="line-badge-small" [style.backgroundColor]="line.color">
                    {{ line.code }}
                  </span>
                  {{ line.name }}
                </span>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Time</mat-label>
          <input
            matInput
            type="time"
            [(ngModel)]="form.time"
            name="time"
            required
          />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!scheduleForm.valid || !form.lineId"
        (click)="save()"
      >
        {{ data.entry ? 'Save Changes' : 'Create Entry' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-container {
      display: flex;
      flex-direction: column;
      min-width: 350px;
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }

    .line-option {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .line-badge-small {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }
  `,
})
export class ScheduleDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ScheduleDialogComponent>);
  readonly data = inject<ScheduleDialogData>(MAT_DIALOG_DATA);

  form: CreateTimedEntryRequest = {
    time: this.data.entry?.time ?? '',
    lineId: this.data.entry?.line?.id ?? (this.data.lines.length === 1 ? this.data.lines[0].id! : ''),
  };

  save(): void {
    this.dialogRef.close(this.form);
  }
}
