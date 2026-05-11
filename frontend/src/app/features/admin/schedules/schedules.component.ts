import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild, AfterViewInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { ScheduleService } from '@core/api/schedule.service';
import { Line, Stop, Schedule, CreateScheduleRequest } from '@shared/models';
import { ScheduleDialogComponent } from './schedule-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

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
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
    <div class="schedules-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.schedules.title') }}</h1>
        <button
          mat-flat-button
          color="primary"
          (click)="openCreateDialog()"
          [disabled]="!selectedStop()"
        >
          <mat-icon>add</mat-icon>
          {{ t('admin.schedules.newEntry') }}
        </button>
      </div>

      <mat-card class="selector-card">
        <mat-card-content>
          <div class="selector-row">
            <mat-form-field appearance="outline">
              <mat-label>{{ t('admin.schedules.selectLine') }}</mat-label>
              <mat-select [(ngModel)]="selectedLineId" (selectionChange)="onLineChange()">
                <mat-option value="">{{ t('admin.schedules.selectLineOption') }}</mat-option>
                @for (line of lines(); track line.id) {
                  <mat-option [value]="line.id">
                    {{ line.code }} - {{ line.name }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ t('admin.schedules.selectStop') }}</mat-label>
              <mat-select
                [(ngModel)]="selectedStopId"
                (selectionChange)="loadSchedules()"
                [disabled]="!selectedLineId"
              >
                <mat-option value="">{{ t('admin.schedules.selectStopOption') }}</mat-option>
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
          <mat-card animate.enter="fade-in">
            <mat-card-header>
              <mat-card-title>{{ t('admin.schedules.scheduleFor', { name: selectedStop()!.name }) }}</mat-card-title>
            </mat-card-header>
            <app-empty-state
              icon="schedule"
              iconColor="primary"
              [title]="t('admin.schedules.emptyTitle')"
              [description]="t('admin.schedules.emptyDescription')"
              [actionLabel]="t('admin.schedules.emptyAction')"
              actionIcon="add"
              (action)="openCreateDialog()"
            />
          </mat-card>
        } @else {
          <mat-card animate.enter="fade-in">
            <mat-card-header>
              <mat-card-title>{{ t('admin.schedules.scheduleFor', { name: selectedStop()!.name }) }}</mat-card-title>
            </mat-card-header>
            <table mat-table [dataSource]="dataSource" matSort class="full-width">
              <ng-container matColumnDef="line">
                <th mat-header-cell *matHeaderCellDef>{{ t('admin.schedules.colLine') }}</th>
                <td mat-cell *matCellDef="let entry">
                  <span class="line-badge" [style.backgroundColor]="entry.itinerary.line.color">
                    {{ entry.itinerary.line.code }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="destination">
                <th mat-header-cell *matHeaderCellDef>{{ t('admin.schedules.colDestination') }}</th>
                <td mat-cell *matCellDef="let entry" class="destination-cell">
                  {{ entry.itinerary.terminusName || t('admin.schedules.noTerminus') }}
                </td>
              </ng-container>

              <ng-container matColumnDef="time">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ t('admin.schedules.colTime') }}</th>
                <td mat-cell *matCellDef="let entry" class="time-cell">
                  {{ formatTime(entry.time) }}
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="actions-column">{{ t('admin.common.actions') }}</th>
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
            [title]="t('admin.schedules.selectStopPrompt')"
            [description]="t('admin.schedules.selectStopPromptDesc')"
          />
        </mat-card>
      }
    </div>
    </ng-container>
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
      border-radius: var(--app-radius-md);
    }

    .selector-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: var(--app-gap-grid);
    }

    .selector-row mat-form-field {
      width: 100%;
    }

    .full-width {
      width: 100%;
    }

    mat-card {
      border-radius: var(--app-radius-md);
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
      border-radius: var(--app-line-badge-radius);
      color: white;
      font-size: 12px;
      font-weight: 600;
    }

    .actions-column {
      text-align: right;
      width: var(--app-actions-column-width);
    }

    /* Enter animations defined globally — see styles.scss section 13a */

    @media (max-width: 600px) {
      .selector-row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class SchedulesComponent implements OnInit, AfterViewInit {
  private readonly lineService = inject(LineService);
  private readonly stopService = inject(StopService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  readonly sort = viewChild(MatSort);
  loading = signal(false);
  lines = signal<Line[]>([]);
  stops = signal<Stop[]>([]);
  dataSource = new MatTableDataSource<Schedule>([]);
  selectedStop = signal<Stop | null>(null);

  selectedLineId = '';
  selectedStopId = '';
  displayedColumns = ['line', 'destination', 'time', 'actions'];

  ngOnInit(): void {
    this.lineService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.notify.error(this.transloco.translate('admin.schedules.loadLinesFailed')),
    });
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      this.dataSource.sort = sortRef;
    }
  }

  onLineChange(): void {
    this.selectedStopId = '';
    this.selectedStop.set(null);
    this.dataSource.data = [];
    if (this.selectedLineId) {
      this.stopService
        .getAll(this.selectedLineId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (stops) => this.stops.set(stops),
          error: () => this.notify.error(this.transloco.translate('admin.schedules.loadStopsFailed')),
        });
    } else {
      this.stops.set([]);
    }
  }

  loadSchedules(): void {
    if (this.selectedStopId) {
      this.loading.set(true);
      const stop = this.stops().find((s) => s.id === this.selectedStopId);
      this.selectedStop.set(stop ?? null);
      this.scheduleService.getForStop(this.selectedStopId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (schedules) => {
          this.dataSource.data = schedules.sort((a, b) => a.time.localeCompare(b.time));
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.schedules.loadFailed')));
        },
      });
    } else {
      this.selectedStop.set(null);
      this.dataSource.data = [];
    }
  }

  openCreateDialog(): void {
    const stop = this.selectedStop();
    if (!stop) {return;}

    const dialogRef = this.dialog.open(ScheduleDialogComponent, {
      data: { lines: stop.lines },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.schedules.dialog.titleCreate'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.scheduleService.create(this.selectedStopId, result as CreateScheduleRequest).subscribe({
          next: () => {
            this.loadSchedules();
            this.notify.success(this.transloco.translate('admin.schedules.createSuccess'));
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.schedules.createFailed')));
          },
        });
      }
    });
  }

  openEditDialog(entry: Schedule): void {
    const stop = this.selectedStop();
    if (!stop) {return;}

    const dialogRef = this.dialog.open(ScheduleDialogComponent, {
      data: { entry, lines: stop.lines },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.schedules.dialog.titleEdit'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.scheduleService.update(entry.id, result as CreateScheduleRequest).subscribe({
          next: () => {
            this.loadSchedules();
            this.notify.success(this.transloco.translate('admin.schedules.updateSuccess'));
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.schedules.updateFailed')));
          },
        });
      }
    });
  }

  deleteSchedule(entry: Schedule): void {
    const terminusName = entry.itinerary.terminusName ?? 'unknown';
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.transloco.translate('admin.schedules.confirm.deleteTitle'),
        message: this.transloco.translate('admin.schedules.confirm.deleteMessage', { time: this.formatTime(entry.time), terminus: terminusName }),
        confirmText: this.transloco.translate('common.delete'),
        confirmColor: 'warn',
      },
      ariaLabel: this.transloco.translate('admin.schedules.confirm.deleteTitle'),
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.scheduleService.delete(entry.id).subscribe({
          next: () => {
            this.loadSchedules();
            this.notify.success(this.transloco.translate('admin.schedules.deleteSuccess'));
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.schedules.deleteFailed')));
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
