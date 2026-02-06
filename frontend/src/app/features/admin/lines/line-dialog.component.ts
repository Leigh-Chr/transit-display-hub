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
import { Line, CreateLineRequest, LineType } from '@shared/models';

export interface LineDialogData {
  line?: Line;
}

interface LineForm {
  code: string;
  name: string;
  color: string;
  type: LineType | null;
}

@Component({
  selector: 'app-line-dialog',
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
    <h2 mat-dialog-title>{{ data.line ? 'Edit Line' : 'New Line' }}</h2>
    <mat-dialog-content>
      <form #lineForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Code</mat-label>
          <input
            matInput
            [(ngModel)]="form.code"
            name="code"
            placeholder="e.g., L1, M2, T3"
            required
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input
            matInput
            [(ngModel)]="form.name"
            name="name"
            placeholder="e.g., Line 1 - Downtown Express"
            required
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Type</mat-label>
          <mat-select [(ngModel)]="form.type" name="type">
            <mat-option [value]="null">Not specified</mat-option>
            @for (type of lineTypes; track type) {
              <mat-option [value]="type">{{ type }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="color-field">
          <mat-form-field appearance="outline" class="color-text-field">
            <mat-label>Color</mat-label>
            <input
              matInput
              [(ngModel)]="form.color"
              name="color"
              placeholder="#0078D4"
              required
            />
          </mat-form-field>
          <input
            type="color"
            [(ngModel)]="form.color"
            name="colorPicker"
            class="color-picker"
          />
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!lineForm.valid"
        (click)="save()"
      >
        {{ data.line ? 'Save Changes' : 'Create Line' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: var(--app-dialog-min-width);
      padding-top: 12px;
    }

    .full-width {
      width: 100%;
    }

    .color-field {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .color-text-field {
      flex: 1;
    }

    .color-picker {
      width: 56px;
      height: 56px;
      border: 1px solid var(--app-outline);
      border-radius: var(--app-radius-sm);
      cursor: pointer;
      padding: 4px;
      background: var(--app-surface-container);
      transition: border-color 0.2s ease;
    }

    .color-picker:hover {
      border-color: var(--app-on-surface-variant);
    }

    .color-picker:focus {
      outline: 2px solid var(--app-primary);
      outline-offset: 2px;
    }
  `,
})
export class LineDialogComponent {
  readonly dialogRef = inject(MatDialogRef<LineDialogComponent>);
  readonly data = inject<LineDialogData>(MAT_DIALOG_DATA);

  readonly lineTypes: LineType[] = ['METRO', 'BUS', 'TRAM', 'TRAIN'];

  form: LineForm = {
    code: this.data.line?.code ?? '',
    name: this.data.line?.name ?? '',
    color: this.data.line?.color ?? '#0078D4',
    type: this.data.line?.type ?? null,
  };

  save(): void {
    const request: CreateLineRequest = {
      code: this.form.code,
      name: this.form.name,
      color: this.form.color,
      type: this.form.type ?? undefined,
    };
    this.dialogRef.close(request);
  }
}
