import { Component, OnInit, inject, signal, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { Subject, takeUntil } from 'rxjs';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { ScheduleService } from '@core/api/schedule.service';
import { Line, Stop, TimedEntry } from '@shared/models';
import { ScheduleDialogComponent, ScheduleDialogData } from './schedule-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { fadeIn } from '@shared/animations';

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSortModule,
    TableSkeletonComponent,
    EmptyStateComponent,
  ],
  animations: [fadeIn],
  template: `
    <div class="schedules-page">
      <div class="page-header">
        <h1 class="page-title">Schedules</h1>
        <button
          mat-flat-button
          color="primary"
          (click)="openCreateDialog()"
          [disabled]="!selectedStop()"
        >
          <mat-icon>add</mat-icon>
          New Schedule Entry
        </button>
      </div>

      <mat-card class="selector-card">
        <mat-card-content>
          <div class="selector-row">
            <mat-form-field appearance="outline">
              <mat-label>Line</mat-label>
              <mat-select [(ngModel)]="selectedLineId" (selectionChange)="onLineChange()">
                <mat-option value="">Select a line</mat-option>
                @for (line of lines(); track line.id) {
                  <mat-option [value]="line.id">
                    {{ line.code }} - {{ line.name }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Stop</mat-label>
              <mat-select
                [(ngModel)]="selectedStopId"
                (selectionChange)="loadSchedules()"
                [disabled]="!selectedLineId"
              >
                <mat-option value="">Select a stop</mat-option>
                @for (stop of stops(); track stop.id) {
                  <mat-option [value]="stop.id">{{ stop.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      @if (selectedStop()) {
        @if (loading()) {
          <app-table-skeleton
            [rows]="6"
            [columns]="[{ width: '100px' }, { width: '150px' }, { width: '80px' }]"
          />
        } @else if (dataSource.data.length === 0) {
          <mat-card @fadeIn>
            <mat-card-header>
              <mat-card-title>Schedule for {{ selectedStop()!.name }}</mat-card-title>
            </mat-card-header>
            <app-empty-state
              icon="schedule"
              iconColor="primary"
              title="No schedule entries"
              description="Add departure times for this stop."
              actionLabel="Add Entry"
              actionIcon="add"
              (action)="openCreateDialog()"
            />
          </mat-card>
        } @else {
          <mat-card @fadeIn>
            <mat-card-header>
              <mat-card-title>Schedule for {{ selectedStop()!.name }}</mat-card-title>
            </mat-card-header>
            <table mat-table [dataSource]="dataSource" matSort class="full-width">
              <ng-container matColumnDef="line">
                <th mat-header-cell *matHeaderCellDef>Line</th>
                <td mat-cell *matCellDef="let entry">
                  <span class="line-badge" [style.backgroundColor]="entry.route.line.color">
                    {{ entry.route.line.code }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="destination">
                <th mat-header-cell *matHeaderCellDef>Destination</th>
                <td mat-cell *matCellDef="let entry" class="destination-cell">
                  {{ entry.route.terminusName }}
                </td>
              </ng-container>

              <ng-container matColumnDef="time">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Time</th>
                <td mat-cell *matCellDef="let entry" class="time-cell">
                  {{ formatTime(entry.time) }}
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
                <td mat-cell *matCellDef="let entry" class="actions-column">
                  <button mat-icon-button color="primary" (click)="openEditDialog(entry)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteSchedule(entry)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </mat-card>
        }
      } @else {
        <mat-card>
          <app-empty-state
            icon="touch_app"
            title="Select a stop"
            description="Choose a line and stop from the selectors above to view and manage schedules."
          />
        </mat-card>
      }
    </div>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }

    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--app-on-surface);
      margin: 0;
      letter-spacing: -0.5px;
    }

    .selector-card {
      margin-bottom: 28px;
      border-radius: 12px;
    }

    .selector-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }

    .selector-row mat-form-field {
      width: 100%;
    }

    .full-width {
      width: 100%;
    }

    mat-card {
      border-radius: 12px;
      overflow: hidden;
    }

    .time-cell {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 18px;
      font-weight: 600;
      color: var(--app-on-surface);
    }

    .destination-cell {
      font-size: 14px;
      color: var(--app-on-surface-variant);
    }

    .line-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 16px;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }

    .actions-column {
      text-align: right;
      width: 120px;
    }

    @media (max-width: 600px) {
      .selector-row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class SchedulesComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly lineService = inject(LineService);
  private readonly stopService = inject(StopService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroy$ = new Subject<void>();

  readonly sort = viewChild(MatSort);
  loading = signal(false);
  lines = signal<Line[]>([]);
  stops = signal<Stop[]>([]);
  dataSource = new MatTableDataSource<TimedEntry>([]);
  selectedStop = signal<Stop | null>(null);

  selectedLineId = '';
  selectedStopId = '';
  displayedColumns = ['line', 'destination', 'time', 'actions'];

  ngOnInit(): void {
    this.lineService.getAll().pipe(takeUntil(this.destroy$)).subscribe((lines) => this.lines.set(lines));
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      this.dataSource.sort = sortRef;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onLineChange(): void {
    this.selectedStopId = '';
    this.selectedStop.set(null);
    this.dataSource.data = [];
    if (this.selectedLineId) {
      this.stopService
        .getAll(this.selectedLineId)
        .pipe(takeUntil(this.destroy$))
        .subscribe((stops) => this.stops.set(stops));
    } else {
      this.stops.set([]);
    }
  }

  loadSchedules(): void {
    if (this.selectedStopId) {
      this.loading.set(true);
      const stop = this.stops().find((s) => s.id === this.selectedStopId);
      this.selectedStop.set(stop || null);
      this.scheduleService.getForStop(this.selectedStopId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (schedules) => {
          this.dataSource.data = schedules.sort((a, b) => a.time.localeCompare(b.time));
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const message = err.error?.message || 'Failed to load schedules';
          this.snackBar.open(message, 'Close', { duration: 5000 });
        },
      });
    } else {
      this.selectedStop.set(null);
      this.dataSource.data = [];
    }
  }

  openCreateDialog(): void {
    const stop = this.selectedStop();
    if (!stop) return;

    const dialogRef = this.dialog.open(ScheduleDialogComponent, {
      data: { lines: stop.lines } as ScheduleDialogData,
      width: '450px',
      ariaLabel: 'Create new schedule entry',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.scheduleService.create(this.selectedStopId, result).subscribe({
          next: () => {
            this.loadSchedules();
            this.snackBar.open('Schedule entry created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to create schedule entry';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  openEditDialog(entry: TimedEntry): void {
    const stop = this.selectedStop();
    if (!stop) return;

    const dialogRef = this.dialog.open(ScheduleDialogComponent, {
      data: { entry, lines: stop.lines } as ScheduleDialogData,
      width: '450px',
      ariaLabel: `Edit schedule entry at ${this.formatTime(entry.time)}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.scheduleService.update(entry.id, result).subscribe({
          next: () => {
            this.loadSchedules();
            this.snackBar.open('Schedule entry updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to update schedule entry';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  deleteSchedule(entry: TimedEntry): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Schedule Entry',
        message: `Delete schedule entry at ${this.formatTime(entry.time)} to ${entry.route.terminusName}?`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of schedule entry at ${this.formatTime(entry.time)}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.scheduleService.delete(entry.id).subscribe({
          next: () => {
            this.loadSchedules();
            this.snackBar.open('Schedule entry deleted', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to delete schedule entry';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  formatTime(time: string): string {
    // Time comes as "HH:MM:SS" - show only HH:MM
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  }
}
