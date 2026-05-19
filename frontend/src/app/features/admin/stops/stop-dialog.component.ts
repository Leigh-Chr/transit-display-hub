import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { Stop, Line, CreateStopRequest } from '@shared/models';
import { TranslocoDirective } from '@jsverse/transloco';
import { runDialogSubmit } from '@shared/admin/dialog-submit';
import { CrudDialogComponent } from '@shared/components/crud-dialog/crud-dialog.component';

export interface StopDialogData {
  stop?: Stop;
  lines: Line[];
  selectedLineId?: string;
  submit: (request: CreateStopRequest) => Observable<Stop>;
  onError?: (err: unknown) => void;
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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    CrudDialogComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <app-crud-dialog
      [title]="data.stop ? t('admin.stops.dialog.titleEdit') : t('admin.stops.dialog.titleCreate')"
      [submitLabel]="data.stop ? t('admin.stops.dialog.actionSave') : t('admin.stops.dialog.actionCreate')"
      [cancelLabel]="t('common.cancel')"
      [submitDisabled]="!stopForm.valid || form.lineIds.length === 0"
      [submitting]="submitting()"
      (submitted)="save()"
    >
      <form #stopForm="ngForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.stops.dialog.fieldLines') }}</mat-label>
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
          <mat-hint>{{ t('admin.stops.dialog.fieldLinesHint') }}</mat-hint>
          <mat-error>{{ t('admin.stops.dialog.fieldLinesRequired') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.stops.dialog.fieldName') }}</mat-label>
          <input
            matInput
            [(ngModel)]="form.name"
            name="name"
            [placeholder]="t('admin.stops.dialog.fieldNamePlaceholder')"
            required
          />
          <mat-error>{{ t('admin.stops.dialog.fieldNameRequired') }}</mat-error>
        </mat-form-field>

        <div class="coordinates-row">
          <mat-form-field appearance="outline" class="coordinate-field">
            <mat-label>{{ t('admin.stops.dialog.fieldLatitude') }}</mat-label>
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
            <mat-label>{{ t('admin.stops.dialog.fieldLongitude') }}</mat-label>
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
    </app-crud-dialog>
    </ng-container>
  `,
  styles: `
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

  readonly submitting = signal(false);

  save(): void {
    const request: CreateStopRequest = {
      lineIds: this.form.lineIds,
      name: this.form.name,
      latitude: this.form.latitude ?? undefined,
      longitude: this.form.longitude ?? undefined,
    };
    runDialogSubmit(this.submitting, () => this.data.submit(request), this.dialogRef, this.data.onError);
  }
}
