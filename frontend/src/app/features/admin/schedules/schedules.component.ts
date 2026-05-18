import { ChangeDetectionStrategy, Component, inject, signal, viewChild, AfterViewInit, DestroyRef } from '@angular/core';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { StopService } from '@core/api/stop.service';
import { ScheduleService } from '@core/api/schedule.service';
import { Stop, Schedule, CreateScheduleRequest } from '@shared/models';
import { useLinesResource } from '@shared/admin/use-lines-resource';
import { ScheduleDialogComponent } from './schedule-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { confirmAndDelete } from '@shared/admin/confirm-and-delete';
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
    MatTooltipModule,
    TableSkeletonComponent,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedules.component.html',
  styleUrl: './schedules.component.scss',
})
export class SchedulesComponent implements AfterViewInit {
  private readonly stopService = inject(StopService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  readonly sort = viewChild(MatSort);
  loading = signal(false);
  loadError = signal<string | null>(null);
  readonly lines = useLinesResource('admin.schedules');
  stops = signal<Stop[]>([]);
  dataSource = new MatTableDataSource<Schedule>([]);
  selectedStop = signal<Stop | null>(null);

  selectedLineId = '';
  selectedStopId = '';
  displayedColumns = ['line', 'destination', 'time', 'actions'];

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
      this.loadError.set(null);
      const stop = this.stops().find((s) => s.id === this.selectedStopId);
      this.selectedStop.set(stop ?? null);
      this.scheduleService.getForStop(this.selectedStopId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (schedules) => {
          this.dataSource.data = schedules.sort((a, b) => a.time.localeCompare(b.time));
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.loadError.set(httpErrorMessage(err, this.transloco.translate('admin.schedules.loadFailed')));
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
      data: {
        lines: stop.lines,
        submit: (request: CreateScheduleRequest) => this.scheduleService.create(this.selectedStopId, request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.schedules.createFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.schedules.dialog.titleCreate'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadSchedules();
        this.notify.success(this.transloco.translate('admin.schedules.createSuccess'));
      }
    });
  }

  openEditDialog(entry: Schedule): void {
    const stop = this.selectedStop();
    if (!stop) {return;}

    const dialogRef = this.dialog.open(ScheduleDialogComponent, {
      data: {
        entry,
        lines: stop.lines,
        submit: (request: CreateScheduleRequest) => this.scheduleService.update(entry.id, request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.schedules.updateFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.schedules.dialog.titleEdit'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadSchedules();
        this.notify.success(this.transloco.translate('admin.schedules.updateSuccess'));
      }
    });
  }

  deleteSchedule(entry: Schedule): void {
    const terminusName = entry.itinerary.terminusName ?? 'unknown';
    confirmAndDelete(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        titleKey: 'admin.schedules.confirm.deleteTitle',
        messageKey: 'admin.schedules.confirm.deleteMessage',
        messageArgs: { time: this.formatTime(entry.time), terminus: terminusName },
        successKey: 'admin.schedules.deleteSuccess',
        errorKey: 'admin.schedules.deleteFailed',
        delete$: () => this.scheduleService.delete(entry.id),
        onSuccess: () => this.loadSchedules(),
      },
    );
  }

  formatTime(time: string): string {
    // Time comes as "HH:MM:SS" - show only HH:MM
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  }
}
