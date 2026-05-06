import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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
import { Schedule, CreateScheduleRequest, LineInfo, Itinerary } from '@shared/models';
import { ItineraryService } from '@core/api/itinerary.service';

export interface ScheduleDialogData {
  entry?: Schedule;
  lines: LineInfo[];
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
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ data.entry ? 'Edit Schedule Entry' : 'New Schedule Entry' }}
    </h2>
    <mat-dialog-content>
      <form #scheduleForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Itinerary</mat-label>
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
                      <span class="line-badge-small" [style.backgroundColor]="line.color">
                        {{ line.code }}
                      </span>
                      {{ itinerary.terminusName || itinerary.name }}
                    </span>
                  </mat-option>
                }
              </mat-optgroup>
            }
          </mat-select>
          <mat-error>Itinerary is required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Time</mat-label>
          <input
            matInput
            type="time"
            [(ngModel)]="form.time"
            name="time"
            required
          />
          <mat-error>Time is required</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!scheduleForm.valid || !form.itineraryId"
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
      gap: 8px;
      min-width: var(--app-dialog-min-width);
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }

    .itinerary-option {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .line-badge-small {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--app-line-badge-radius);
      color: white;
      font-size: 12px;
      font-weight: 600;
    }
  `,
})
export class ScheduleDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<ScheduleDialogComponent>);
  readonly data = inject<ScheduleDialogData>(MAT_DIALOG_DATA);
  private readonly itineraryService = inject(ItineraryService);

  itineraries = signal<Itinerary[]>([]);

  form: CreateScheduleRequest = {
    time: this.data.entry?.time ?? '',
    itineraryId: this.data.entry?.itinerary.id ?? '',
  };

  ngOnInit(): void {
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
    this.dialogRef.close(this.form);
  }
}
