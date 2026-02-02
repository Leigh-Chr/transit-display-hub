import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Itinerary, Line, CreateItineraryRequest } from '@shared/models';

export interface ItineraryDialogData {
  itinerary?: Itinerary;
  lines: Line[];
}

interface ItineraryForm {
  lineId: string;
  name: string;
}

@Component({
  selector: 'app-itinerary-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.itinerary ? 'Edit Itinerary' : 'New Itinerary' }}
    </h2>
    <mat-dialog-content>
      <form #itineraryForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Line</mat-label>
          <mat-select
            [(ngModel)]="form.lineId"
            name="lineId"
            required
            [disabled]="!!data.itinerary"
          >
            @for (line of data.lines; track line.id) {
              <mat-option [value]="line.id">
                <span class="line-option">
                  <span class="line-badge" [style.backgroundColor]="line.color">
                    {{ line.code }}
                  </span>
                  {{ line.name }}
                </span>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Itinerary Name</mat-label>
          <input
            matInput
            [(ngModel)]="form.name"
            name="name"
            required
            maxlength="100"
            placeholder="e.g., Direction Eastern Terminal"
          />
          <mat-hint>Name for this direction/itinerary</mat-hint>
        </mat-form-field>

        @if (!data.itinerary) {
          <p class="info-text">
            <mat-icon class="info-icon">info</mat-icon>
            After creating the itinerary, you can add stops to define the terminus.
          </p>
        } @else if (data.itinerary.terminusName) {
          <p class="terminus-info">
            <strong>Terminus:</strong> {{ data.itinerary.terminusName }}
            <br />
            <span class="muted">The terminus is automatically derived from the last stop.</span>
          </p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!itineraryForm.valid"
        (click)="save()"
      >
        {{ data.itinerary ? 'Save Changes' : 'Create Itinerary' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
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

    .line-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }

    .info-text {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: var(--app-on-surface-muted);
      font-size: 13px;
      margin: 8px 0 0;
      padding: 12px;
      background: var(--app-surface-variant);
      border-radius: 8px;
    }

    .info-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--app-primary);
    }

    .terminus-info {
      font-size: 14px;
      margin: 8px 0 0;
      padding: 12px;
      background: var(--app-surface-variant);
      border-radius: 8px;
    }

    .muted {
      color: var(--app-on-surface-muted);
      font-size: 12px;
    }
  `,
})
export class ItineraryDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ItineraryDialogComponent>);
  readonly data = inject<ItineraryDialogData>(MAT_DIALOG_DATA);

  form: ItineraryForm = {
    lineId: this.data.itinerary?.line?.id ?? '',
    name: this.data.itinerary?.name ?? '',
  };

  save(): void {
    const request: CreateItineraryRequest = {
      lineId: this.form.lineId,
      name: this.form.name,
    };
    this.dialogRef.close(request);
  }
}
