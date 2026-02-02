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
import { TimedEntry, CreateTimedEntryRequest, LineInfo, Route } from '@shared/models';
import { RouteService } from '@core/api/route.service';

export interface ScheduleDialogData {
  entry?: TimedEntry;
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
  template: `
    <h2 mat-dialog-title>
      {{ data.entry ? 'Edit Schedule Entry' : 'New Schedule Entry' }}
    </h2>
    <mat-dialog-content>
      <form #scheduleForm="ngForm" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Route</mat-label>
          <mat-select
            [(ngModel)]="form.routeId"
            name="routeId"
            required
          >
            @for (line of data.lines; track line.id) {
              <mat-optgroup [label]="line.code + ' - ' + line.name">
                @for (route of getRoutesForLine(line.id!); track route.id) {
                  <mat-option [value]="route.id">
                    <span class="route-option">
                      <span class="line-badge-small" [style.backgroundColor]="line.color">
                        {{ line.code }}
                      </span>
                      {{ route.terminusName }}
                    </span>
                  </mat-option>
                }
              </mat-optgroup>
            }
          </mat-select>
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
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!scheduleForm.valid || !form.routeId"
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
      min-width: 350px;
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }

    .route-option {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .line-badge-small {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }
  `,
})
export class ScheduleDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<ScheduleDialogComponent>);
  readonly data = inject<ScheduleDialogData>(MAT_DIALOG_DATA);
  private readonly routeService = inject(RouteService);

  routes = signal<Route[]>([]);

  form: CreateTimedEntryRequest = {
    time: this.data.entry?.time ?? '',
    routeId: this.data.entry?.route?.id ?? '',
  };

  ngOnInit(): void {
    this.loadRoutes();
  }

  private loadRoutes(): void {
    this.routeService.getAll().subscribe(routes => {
      this.routes.set(routes);

      // If we have lines but no routeId selected yet, and there's only one route total,
      // auto-select it
      if (!this.form.routeId && routes.length === 1) {
        this.form.routeId = routes[0].id;
      }
    });
  }

  getRoutesForLine(lineId: string): Route[] {
    return this.routes().filter(r => r.line.id === lineId);
  }

  save(): void {
    this.dialogRef.close(this.form);
  }
}
