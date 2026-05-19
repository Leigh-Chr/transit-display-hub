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
import { Schedule, CreateScheduleRequest, LineInfo, Itinerary } from '@shared/models';
import { ItineraryService } from '@core/api/itinerary.service';
import { TranslocoDirective } from '@jsverse/transloco';
import { runDialogSubmit } from '@shared/admin/dialog-submit';
import { CrudDialogComponent } from '@shared/components/crud-dialog/crud-dialog.component';
import { LineBadgeComponent } from '@shared/components/line-badge/line-badge.component';

export interface ScheduleDialogData {
  entry?: Schedule;
  lines: LineInfo[];
  submit: (request: CreateScheduleRequest) => Observable<Schedule>;
  onError?: (err: unknown) => void;
}

@Component({
  selector: 'app-schedule-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
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
      [title]="data.entry ? t('admin.schedules.dialog.titleEdit') : t('admin.schedules.dialog.titleCreate')"
      [submitLabel]="data.entry ? t('admin.schedules.dialog.actionSave') : t('admin.schedules.dialog.actionCreate')"
      [cancelLabel]="t('common.cancel')"
      [submitDisabled]="!scheduleForm.valid || !form.itineraryId"
      [submitting]="submitting()"
      (submitted)="save()"
    >
      <form #scheduleForm="ngForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.schedules.dialog.fieldItinerary') }}</mat-label>
          <mat-select
            [(ngModel)]="form.itineraryId"
            name="itineraryId"
            required
          >
            @for (line of data.lines; track line.id) {
              <mat-optgroup [label]="line.code + ' - ' + line.name">
                @for (itinerary of getItinerariesForLine(line.id!); track itinerary.id) {
                  <mat-option [value]="itinerary.id">
                    <span class="itinerary-option">
                      <app-line-badge [code]="line.code" [color]="line.color" />
                      {{ itinerary.terminusName || itinerary.name }}
                    </span>
                  </mat-option>
                }
              </mat-optgroup>
            }
          </mat-select>
          <mat-error>{{ t('admin.schedules.dialog.fieldItineraryRequired') }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ t('admin.schedules.dialog.fieldTime') }}</mat-label>
          <input
            matInput
            type="time"
            [(ngModel)]="form.time"
            name="time"
            required
          />
          <mat-error>{{ t('admin.schedules.dialog.fieldTimeRequired') }}</mat-error>
        </mat-form-field>
      </form>
    </app-crud-dialog>
    </ng-container>
  `,
  styles: `
    .full-width {
      width: 100%;
    }

    .itinerary-option {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  `,
})
export class ScheduleDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ScheduleDialogComponent>);
  readonly data = inject<ScheduleDialogData>(MAT_DIALOG_DATA);
  private readonly itineraryService = inject(ItineraryService);

  itineraries = signal<Itinerary[]>([]);
  readonly submitting = signal(false);

  form: CreateScheduleRequest = {
    time: this.data.entry?.time ?? '',
    itineraryId: this.data.entry?.itinerary.id ?? '',
  };

  constructor() {
    this.loadItineraries();
  }

  private loadItineraries(): void {
    this.itineraryService.getAll().subscribe({
      next: (itineraries) => {
        this.itineraries.set(itineraries);

        // If we have lines but no itineraryId selected yet, and there's only one itinerary total,
        // auto-select it
        const firstItinerary = itineraries[0];
        if (!this.form.itineraryId && itineraries.length === 1 && firstItinerary) {
          this.form.itineraryId = firstItinerary.id;
        }
      },
      error: () => this.itineraries.set([]),
    });
  }

  getItinerariesForLine(lineId: string): Itinerary[] {
    return this.itineraries().filter(i => i.line.id === lineId);
  }

  save(): void {
    runDialogSubmit(this.submitting, () => this.data.submit(this.form), this.dialogRef, this.data.onError);
  }
}
