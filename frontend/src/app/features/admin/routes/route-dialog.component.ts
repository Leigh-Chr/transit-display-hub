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
import { Route, Line, CreateRouteRequest } from '@shared/models';

export interface RouteDialogData {
  route?: Route;
  lines: Line[];
}

@Component({
  selector: 'app-route-dialog',
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
      {{ data.route ? 'Edit Route' : 'New Route' }}
    </h2>
    <mat-dialog-content>
      <form #routeForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Line</mat-label>
          <mat-select
            [(ngModel)]="form.lineId"
            name="lineId"
            required
            [disabled]="!!data.route"
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
          <mat-label>Route Name</mat-label>
          <input
            matInput
            [(ngModel)]="form.name"
            name="name"
            required
            maxlength="100"
            placeholder="e.g., Direction Eastern Terminal"
          />
          <mat-hint>Internal name for this route direction</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Terminus Name</mat-label>
          <input
            matInput
            [(ngModel)]="form.terminusName"
            name="terminusName"
            required
            maxlength="100"
            placeholder="e.g., Eastern Terminal"
          />
          <mat-hint>Destination displayed on kiosks</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!routeForm.valid"
        (click)="save()"
      >
        {{ data.route ? 'Save Changes' : 'Create Route' }}
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
  `,
})
export class RouteDialogComponent {
  readonly dialogRef = inject(MatDialogRef<RouteDialogComponent>);
  readonly data = inject<RouteDialogData>(MAT_DIALOG_DATA);

  form: CreateRouteRequest = {
    lineId: this.data.route?.line?.id ?? '',
    name: this.data.route?.name ?? '',
    terminusName: this.data.route?.terminusName ?? '',
  };

  save(): void {
    this.dialogRef.close(this.form);
  }
}
