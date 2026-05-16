import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, EMPTY } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { Line, Stop, CreateStopRequest } from '@shared/models';
import { StopDialogComponent } from './stop-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import {
  HubDisplayDialogComponent,
  HubDisplayDialogResult,
} from '@shared/components/hub-display-dialog/hub-display-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { createAdminListResource } from '@shared/admin/admin-list-resource';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { ADMIN_PAGE_SIZE_OPTIONS } from '@shared/utils/pagination.constants';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-stops',
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
    MatPaginatorModule,
    MatTooltipModule,
    TableSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
  templateUrl: './stops.component.html',
  styleUrl: './stops.component.scss',
})
export class StopsComponent {
  private readonly lineService = inject(LineService);
  private readonly stopService = inject(StopService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  readonly tableState = inject(AdminTableState);
  protected readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;
  readonly displayedColumns = ['line', 'name', 'schedules', 'device', 'actions'];

  // lineId is a writable signal so onLineChange() can update it and the
  // extras supplier picks the change up on the next URL write.
  readonly lineId = signal('');

  // Lines are loaded once and do not depend on pagination state.
  private readonly linesResource = rxResource<Line[], undefined>({
    stream: () =>
      this.lineService.getAll().pipe(
        catchError(() => {
          this.notify.error(this.transloco.translate('admin.stops.loadLinesFailed'));
          return EMPTY;
        }),
      ),
  });

  readonly lines = computed((): Line[] =>
    this.linesResource.hasValue() ? this.linesResource.value() : [],
  );

  private readonly list = createAdminListResource<Stop>({
    tableState: this.tableState,
    defaults: { sortBy: 'name' },
    extras: {
      supply: () => ({ lineId: this.lineId() }),
      syncFromUrl: (params) => {
        const qpLineId = (params['lineId'] as string | undefined) ?? '';
        if (qpLineId !== this.lineId()) {
          this.lineId.set(qpLineId);
        }
      },
    },
    fetch: (request, raw) =>
      this.stopService.getAllPaginated({
        page: request.page,
        size: request.size,
        sortBy: request.sortBy,
        sortDir: request.sortDir,
        search: request.search,
        lineId: (raw['lineId'] as string | undefined) ?? undefined,
      }),
  });

  readonly loading = this.list.loading;
  readonly loadError = this.list.loadError;
  readonly stops = this.list.items;
  readonly totalElements = this.list.totalElements;

  loadStops(): void {
    this.list.reload();
  }

  onLineChange(lineId: string): void {
    this.lineId.set(lineId);
    this.tableState.resetToFirstPage();
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(StopDialogComponent, {
      data: {
        lines: this.lines(),
        selectedLineId: this.lineId(),
        submit: (request: CreateStopRequest) => this.stopService.create(request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.stops.createFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.stops.dialog.titleCreate'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.tableState.resetToFirstPage();
        this.loadStops();
        this.notify.success(this.transloco.translate('admin.stops.createSuccess'));
      }
    });
  }

  openEditDialog(stop: Stop): void {
    const dialogRef = this.dialog.open(StopDialogComponent, {
      data: {
        stop,
        lines: this.lines(),
        submit: (request: CreateStopRequest) => this.stopService.update(stop.id, request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.stops.updateFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.stops.dialog.titleEdit'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadStops();
        this.notify.success(this.transloco.translate('admin.stops.updateSuccess'));
      }
    });
  }

  deleteStop(stop: Stop): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.transloco.translate('admin.stops.confirm.deleteTitle'),
        message: this.transloco.translate('admin.stops.confirm.deleteMessage', { name: stop.name }),
        confirmText: this.transloco.translate('common.delete'),
        cancelText: this.transloco.translate('common.cancel'),
        confirmColor: 'warn',
      },
      ariaLabel: this.transloco.translate('admin.stops.confirm.deleteTitle'),
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.stopService.delete(stop.id).subscribe({
          next: () => {
            this.loadStops();
            this.notify.success(this.transloco.translate('admin.stops.deleteSuccess'));
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.stops.deleteFailed')));
          },
        });
      }
    });
  }

  openHubDisplay(): void {
    this.dialog
      .open(HubDisplayDialogComponent, {
        data: { lines: this.lines() },
        width: '550px',
      })
      .afterClosed()
      .subscribe((result: HubDisplayDialogResult | undefined) => {
        if (result) {
          const params = new URLSearchParams();
          params.set('stopIds', result.stopIds.join(','));
          params.set('name', result.hubName);
          window.open(`/hub?${params.toString()}`, '_blank');
        }
      });
  }

  openKioskPreview(stopId: string): void {
    window.open(`/display/${stopId}`, '_blank');
  }
}
