import { Component, inject, OnInit, signal } from '@angular/core';
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
import { Stop, Line, CreateStopRequest } from '@shared/models';
import { LineService } from '@core/api/line.service';

export interface StopDialogData {
  stop?: Stop;
  lines: Line[];
  selectedLineId?: string;
}

@Component({
  selector: 'app-stop-dialog',
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
    <h2 mat-dialog-title>{{ data.stop ? 'Edit Stop' : 'New Stop' }}</h2>
    <mat-dialog-content>
      <form #stopForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Line</mat-label>
          <mat-select
            [(ngModel)]="form.lineId"
            name="lineId"
            required
            [disabled]="!!data.stop"
          >
            @for (line of data.lines; track line.id) {
              <mat-option [value]="line.id">
                {{ line.code }} - {{ line.name }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input
            matInput
            [(ngModel)]="form.name"
            name="name"
            placeholder="e.g., Central Station"
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
        [disabled]="!stopForm.valid"
        (click)="save()"
      >
        {{ data.stop ? 'Save Changes' : 'Create Stop' }}
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
  `,
})
export class StopDialogComponent {
  readonly dialogRef = inject(MatDialogRef<StopDialogComponent>);
  readonly data = inject<StopDialogData>(MAT_DIALOG_DATA);

  form: CreateStopRequest = {
    lineId: this.data.stop?.line.id ?? this.data.selectedLineId ?? '',
    name: this.data.stop?.name ?? '',
  };

  save(): void {
    this.dialogRef.close(this.form);
  }
}
