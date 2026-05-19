import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { TranslocoDirective } from '@jsverse/transloco';
import { Itinerary, Line, CreateItineraryRequest } from '@shared/models';
import { runDialogSubmit } from '@shared/admin/dialog-submit';
import { CrudDialogComponent } from '@shared/components/crud-dialog/crud-dialog.component';
import { LineBadgeComponent } from '@shared/components/line-badge/line-badge.component';

export interface ItineraryDialogData {
  itinerary?: Itinerary;
  lines: Line[];
  submit: (request: CreateItineraryRequest) => Observable<Itinerary>;
  onError?: (err: unknown) => void;
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
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    CrudDialogComponent,
    LineBadgeComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <app-crud-dialog
      [title]="data.itinerary ? t('admin.itineraries.dialog.titleEdit') : t('admin.itineraries.dialog.titleCreate')"
      [submitLabel]="data.itinerary ? t('admin.itineraries.dialog.actionSave') : t('admin.itineraries.dialog.actionCreate')"
      [cancelLabel]="t('common.cancel')"
      [submitDisabled]="!itineraryForm.valid"
      [submitting]="submitting()"
      (submitted)="save()"
    >
      <form #itineraryForm="ngForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.itineraries.dialog.fieldLine') }}</mat-label>
          <mat-select
            [(ngModel)]="form.lineId"
            name="lineId"
            required
            [disabled]="!!data.itinerary"
          >
            @for (line of data.lines; track line.id) {
              <mat-option [value]="line.id">
                <span class="line-option">
                  <app-line-badge [code]="line.code" [color]="line.color" />
                  {{ line.name }}
                </span>
              </mat-option>
            }
          </mat-select>
          @if (data.itinerary) {
            <mat-hint>{{ t('admin.itineraries.dialog.fieldLineHint') }}</mat-hint>
          }
          <mat-error>{{ t('admin.itineraries.dialog.fieldLineRequired') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.itineraries.dialog.fieldName') }}</mat-label>
          <input
            matInput
            [(ngModel)]="form.name"
            name="name"
            required
            maxlength="100"
            [placeholder]="t('admin.itineraries.dialog.fieldNamePlaceholder')"
          />
          <mat-hint>{{ t('admin.itineraries.dialog.fieldNameHint') }}</mat-hint>
          <mat-error>{{ t('admin.itineraries.dialog.fieldNameRequired') }}</mat-error>
        </mat-form-field>

        @if (!data.itinerary) {
          <p class="info-text">
            <mat-icon class="info-icon">info</mat-icon>
            {{ t('admin.itineraries.dialog.infoAfterCreate') }}
          </p>
        } @else if (data.itinerary.terminusName) {
          <p class="terminus-info">
            <strong>{{ t('admin.itineraries.dialog.terminusLabel') }}</strong> {{ data.itinerary.terminusName }}
            <br />
            <span class="muted">{{ t('admin.itineraries.dialog.terminusHint') }}</span>
          </p>
        }
      </form>
    </app-crud-dialog>
    </ng-container>
  `,
  styles: `
    .line-option {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .info-text {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: var(--app-on-surface-muted);
      font-size: var(--m3-type-body-small);
      margin: 8px 0 0;
      padding: 12px;
      background: var(--app-surface-variant);
      border-radius: var(--app-radius-sm);
    }

    .info-icon {
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
      color: var(--app-primary);
    }

    .terminus-info {
      font-size: var(--m3-type-body-medium);
      margin: 8px 0 0;
      padding: 12px;
      background: var(--app-surface-variant);
      border-radius: var(--app-radius-sm);
    }

    .muted {
      color: var(--app-on-surface-muted);
      font-size: var(--m3-type-label-medium);
    }
  `,
})
export class ItineraryDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ItineraryDialogComponent>);
  readonly data = inject<ItineraryDialogData>(MAT_DIALOG_DATA);

  form: ItineraryForm = {
    lineId: this.data.itinerary?.line.id ?? '',
    name: this.data.itinerary?.name ?? '',
  };

  readonly submitting = signal(false);

  save(): void {
    const request: CreateItineraryRequest = {
      lineId: this.form.lineId,
      name: this.form.name,
    };
    runDialogSubmit(this.submitting, () => this.data.submit(request), this.dialogRef, this.data.onError);
  }
}
