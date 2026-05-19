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
import { RouterLink } from '@angular/router';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { Line, Stop, CreateStopRequest } from '@shared/models';
import { StopDialogComponent } from './stop-dialog.component';
import {
  HubDisplayDialogComponent,
  HubDisplayDialogResult,
} from './hub-display-dialog/hub-display-dialog.component';
import { AdminFilterToolbarComponent } from '@shared/components/admin-filter-toolbar/admin-filter-toolbar.component';
import { AdminPageHeaderComponent } from '@shared/components/admin-page-header/admin-page-header.component';
import { LineBadgeComponent } from '@shared/components/line-badge/line-badge.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { createAdminListResource } from '@shared/admin/admin-list-resource';
import { confirmAndDelete } from '@shared/admin/confirm-and-delete';
import { openCrudDialog } from '@shared/admin/open-crud-dialog';
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
    RouterLink,
    AdminFilterToolbarComponent,
    AdminPageHeaderComponent,
    LineBadgeComponent,
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
    openCrudDialog(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        component: StopDialogComponent,
        data: { lines: this.lines(), selectedLineId: this.lineId() },
        width: '450px',
        titleKey: 'admin.stops.dialog.titleCreate',
        successKey: 'admin.stops.createSuccess',
        errorKey: 'admin.stops.createFailed',
        submitOp: (request: CreateStopRequest) => this.stopService.create(request),
        onSuccess: () => {
          this.tableState.resetToFirstPage();
          this.loadStops();
        },
      },
    );
  }

  openEditDialog(stop: Stop): void {
    openCrudDialog(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        component: StopDialogComponent,
        data: { stop, lines: this.lines() },
        width: '450px',
        titleKey: 'admin.stops.dialog.titleEdit',
        successKey: 'admin.stops.updateSuccess',
        errorKey: 'admin.stops.updateFailed',
        submitOp: (request: CreateStopRequest) => this.stopService.update(stop.id, request),
        onSuccess: () => this.loadStops(),
      },
    );
  }

  deleteStop(stop: Stop): void {
    confirmAndDelete(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        titleKey: 'admin.stops.confirm.deleteTitle',
        messageKey: 'admin.stops.confirm.deleteMessage',
        messageArgs: { name: stop.name },
        successKey: 'admin.stops.deleteSuccess',
        errorKey: 'admin.stops.deleteFailed',
        delete$: () => this.stopService.delete(stop.id),
        onSuccess: () => this.loadStops(),
      },
    );
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
