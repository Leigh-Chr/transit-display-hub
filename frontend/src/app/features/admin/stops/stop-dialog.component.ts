import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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

export interface StopDialogData {
  stop?: Stop;
  lines: Line[];
  selectedLineId?: string;
}

interface StopForm {
  lineIds: string[];
  name: string;
  latitude: number | null;
  longitude: number | null;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.stop ? 'Edit Stop' : 'New Stop' }}</h2>
    <mat-dialog-content>
      <form #stopForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Lines</mat-label>
          <mat-select
            [(ngModel)]="form.lineIds"
            name="lineIds"
            required
            multiple
          >
            @for (line of data.lines; track line.id) {
              <mat-option [value]="line.id">
                {{ line.code }} - {{ line.name }}
              </mat-option>
            }
          </mat-select>
          <mat-hint>Select one or more lines this stop serves</mat-hint>
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

        <div class="coordinates-row">
          <mat-form-field appearance="outline" class="coordinate-field">
            <mat-label>Latitude</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="form.latitude"
              name="latitude"
              placeholder="e.g., 48.8566"
              step="0.0001"
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="coordinate-field">
            <mat-label>Longitude</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="form.longitude"
              name="longitude"
              placeholder="e.g., 2.3522"
              step="0.0001"
            />
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!stopForm.valid || form.lineIds.length === 0"
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
      gap: 8px;
      min-width: var(--app-dialog-min-width);
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }

    .coordinates-row {
      display: flex;
      gap: 16px;
    }

    .coordinate-field {
      flex: 1;
    }
  `,
})
export class StopDialogComponent {
  readonly dialogRef = inject(MatDialogRef<StopDialogComponent>);
  readonly data = inject<StopDialogData>(MAT_DIALOG_DATA);

  form: StopForm = {
    lineIds: this.data.stop?.lines.map(l => l.id).filter(Boolean) ??
             (this.data.selectedLineId ? [this.data.selectedLineId] : []),
    name: this.data.stop?.name ?? '',
    latitude: this.data.stop?.latitude ?? null,
    longitude: this.data.stop?.longitude ?? null,
  };

  save(): void {
    const request: CreateStopRequest = {
      lineIds: this.form.lineIds,
      name: this.form.name,
      latitude: this.form.latitude ?? undefined,
      longitude: this.form.longitude ?? undefined,
    };
    this.dialogRef.close(request);
  }
}
