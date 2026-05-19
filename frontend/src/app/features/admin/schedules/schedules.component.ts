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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StopService } from '@core/api/stop.service';
import { ScheduleService } from '@core/api/schedule.service';
import { Stop, Schedule, CreateScheduleRequest } from '@shared/models';
import { useLinesResource } from '@shared/admin/use-lines-resource';
import { ScheduleDialogComponent } from './schedule-dialog.component';
import { AdminPageHeaderComponent } from '@shared/components/admin-page-header/admin-page-header.component';
import { LineBadgeComponent } from '@shared/components/line-badge/line-badge.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { confirmAndDelete } from '@shared/admin/confirm-and-delete';
import { openCrudDialog } from '@shared/admin/open-crud-dialog';
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
    RouterLink,
    AdminPageHeaderComponent,
    LineBadgeComponent,
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
  private readonly route = inject(ActivatedRoute);

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

  constructor() {
    // Deep-link from /admin/stops "View schedules" or any other caller:
    // `?lineId=L&stopId=S` pre-selects the line, loads its stops, then
    // pre-selects the target stop and triggers the schedule fetch. Reads
    // queryParams only at boot — switching the selectors after that
    // doesn't push back to the URL, mirroring the existing one-way flow.
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const lineId = (params['lineId'] as string | undefined) ?? '';
        const stopId = (params['stopId'] as string | undefined) ?? '';
        if (!lineId || lineId === this.selectedLineId) {
          return;
        }
        this.selectedLineId = lineId;
        this.fetchStopsForLine(lineId, (loadedStops) => {
          if (!stopId) { return; }
          if (loadedStops.some((s) => s.id === stopId)) {
            this.selectedStopId = stopId;
            this.loadSchedules();
          }
        });
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
      this.fetchStopsForLine(this.selectedLineId);
    } else {
      this.stops.set([]);
    }
  }

  /** Shared fetch used by both the manual selector (onLineChange) and
   *  the boot-time deep-link path (constructor). `onLoaded` fires only
   *  on success and receives the freshly loaded list so the caller can
   *  immediately pick a stop from it without re-reading the signal. */
  private fetchStopsForLine(lineId: string, onLoaded?: (stops: Stop[]) => void): void {
    this.stopService
      .getAll(lineId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stops) => {
          this.stops.set(stops);
          onLoaded?.(stops);
        },
        error: () => this.notify.error(this.transloco.translate('admin.schedules.loadStopsFailed')),
      });
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

    openCrudDialog(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        component: ScheduleDialogComponent,
        data: { lines: stop.lines },
        width: '450px',
        titleKey: 'admin.schedules.dialog.titleCreate',
        successKey: 'admin.schedules.createSuccess',
        errorKey: 'admin.schedules.createFailed',
        submitOp: (request: CreateScheduleRequest) =>
          this.scheduleService.create(this.selectedStopId, request),
        onSuccess: () => this.loadSchedules(),
      },
    );
  }

  openEditDialog(entry: Schedule): void {
    const stop = this.selectedStop();
    if (!stop) {return;}

    openCrudDialog(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        component: ScheduleDialogComponent,
        data: { entry, lines: stop.lines },
        width: '450px',
        titleKey: 'admin.schedules.dialog.titleEdit',
        successKey: 'admin.schedules.updateSuccess',
        errorKey: 'admin.schedules.updateFailed',
        submitOp: (request: CreateScheduleRequest) => this.scheduleService.update(entry.id, request),
        onSuccess: () => this.loadSchedules(),
      },
    );
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
