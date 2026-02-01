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
import { TimedEntry, CreateTimedEntryRequest } from '@shared/models';

export interface ScheduleDialogData {
  entry?: TimedEntry;
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
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.entry ? 'Edit Schedule Entry' : 'New Schedule Entry' }}
    </h2>
    <mat-dialog-content>
      <form #scheduleForm="ngForm" class="form-container">
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
        [disabled]="!scheduleForm.valid"
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
      min-width: 300px;
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }
  `,
})
export class ScheduleDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ScheduleDialogComponent>);
  readonly data = inject<ScheduleDialogData>(MAT_DIALOG_DATA);

  form: CreateTimedEntryRequest = {
    time: this.data.entry?.time ?? '',
  };

  save(): void {
    this.dialogRef.close(this.form);
  }
}
