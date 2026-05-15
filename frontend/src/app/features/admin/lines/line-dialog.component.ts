import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { Line, CreateLineRequest, LineType } from '@shared/models';
import { TranslocoDirective } from '@jsverse/transloco';
import { runDialogSubmit } from '@shared/admin/dialog-submit';

export interface LineDialogData {
  line?: Line;
  submit: (request: CreateLineRequest) => Observable<Line>;
  onError?: (err: unknown) => void;
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
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <h2 mat-dialog-title>{{ data.line ? t('admin.lines.dialog.titleEdit') : t('admin.lines.dialog.titleCreate') }}</h2>
    <mat-dialog-content>
      <form #lineForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.lines.dialog.fieldCode') }}</mat-label>
          <input
            matInput
            [(ngModel)]="form.code"
            name="code"
            [placeholder]="t('admin.lines.dialog.fieldCodePlaceholder')"
            required
          />
          <mat-error>{{ t('admin.lines.dialog.fieldCodeRequired') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.lines.dialog.fieldName') }}</mat-label>
          <input
            matInput
            [(ngModel)]="form.name"
            name="name"
            [placeholder]="t('admin.lines.dialog.fieldNamePlaceholder')"
            required
          />
          <mat-error>{{ t('admin.lines.dialog.fieldNameRequired') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.lines.dialog.fieldType') }}</mat-label>
          <mat-select [(ngModel)]="form.type" name="type" required>
            @for (type of lineTypes; track type) {
              <mat-option [value]="type">{{ type }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ t('admin.lines.dialog.fieldTypeRequired') }}</mat-error>
        </mat-form-field>

        <div class="color-field">
          <mat-form-field appearance="outline" class="color-text-field">
            <mat-label>{{ t('admin.lines.dialog.fieldColor') }}</mat-label>
            <input
              matInput
              [(ngModel)]="form.color"
              name="color"
              placeholder="#0078D4"
              required
            />
            <mat-error>{{ t('admin.lines.dialog.fieldColorRequired') }}</mat-error>
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
      <button mat-button mat-dialog-close [disabled]="submitting()">{{ t('common.cancel') }}</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!lineForm.valid || submitting()"
        (click)="save()"
      >
        @if (submitting()) {
          <mat-progress-spinner mode="indeterminate" diameter="18" />
        }
        {{ data.line ? t('admin.lines.dialog.actionSave') : t('admin.lines.dialog.actionCreate') }}
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

  readonly lineTypes: LineType[] = [
    'METRO',
    'BUS',
    'TRAM',
    'TRAIN',
    'FERRY',
    'FUNICULAR',
    'CABLE_CAR',
    'TROLLEYBUS',
    'MONORAIL',
    'OTHER',
  ];

  form: LineForm = {
    code: this.data.line?.code ?? '',
    name: this.data.line?.name ?? '',
    color: this.data.line?.color ?? '#0078D4',
    type: this.data.line?.type ?? null,
  };

  readonly submitting = signal(false);

  save(): void {
    if (!this.form.type) { return; } // belt-and-suspenders; the form is `required`
    const request: CreateLineRequest = {
      code: this.form.code,
      name: this.form.name,
      color: this.form.color,
      type: this.form.type,
    };
    runDialogSubmit(this.submitting, () => this.data.submit(request), this.dialogRef, this.data.onError);
  }
}
