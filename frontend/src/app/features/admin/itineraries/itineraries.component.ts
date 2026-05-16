import { ChangeDetectionStrategy, Component, inject, signal, viewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ItineraryService } from '@core/api/itinerary.service';
import { LineService } from '@core/api/line.service';
import { AuthService } from '@core/auth/auth.service';
import { Itinerary, Line, UpdateItineraryStopsRequest, CreateItineraryRequest } from '@shared/models';
import { ItineraryDialogComponent } from './itinerary-dialog.component';
import { ItineraryStopsDialogComponent } from './itinerary-stops-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { createAdminListResource } from '@shared/admin/admin-list-resource';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { ADMIN_PAGE_SIZE_OPTIONS } from '@shared/utils/pagination.constants';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-itineraries',
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
    MatChipsModule,
    MatTooltipModule,
    TableSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
  templateUrl: './itineraries.component.html',
  styleUrl: './itineraries.component.scss',
})
export class ItinerariesComponent implements AfterViewInit {
  private readonly itineraryService = inject(ItineraryService);
  private readonly lineService = inject(LineService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  readonly isAdmin = this.authService.isAdmin;
  readonly tableState = inject(AdminTableState);
  protected readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;

  readonly sort = viewChild(MatSort);
  readonly lines = signal<Line[]>([]);
  readonly lineId = signal('');

  private readonly list = createAdminListResource<Itinerary>({
    tableState: this.tableState,
    defaults: { sortBy: 'name' },
    extras: {
      supply: () => ({ lineId: this.lineId() }),
      syncFromUrl: (params) => {
        this.lineId.set((params['lineId'] as string | undefined) ?? '');
      },
    },
    fetch: (request, raw) =>
      this.itineraryService.getAllPaginated({
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
  readonly itineraries = this.list.items;
  readonly totalElements = this.list.totalElements;

  get displayedColumns(): string[] {
    const columns = ['line', 'name', 'terminusName', 'direction', 'stops', 'amenities'];
    if (this.isAdmin()) {
      columns.push('actions');
    }
    return columns;
  }

  constructor() {
    this.lineService.getAll().subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.notify.error(this.transloco.translate('admin.itineraries.loadLinesFailed')),
    });
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      sortRef.active = this.tableState.sortBy;
      sortRef.direction = this.tableState.sortDir;
    }
  }

  loadItineraries(): void {
    this.list.reload();
  }

  onLineChange(lineId: string): void {
    this.lineId.set(lineId);
    this.tableState.resetToFirstPage();
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(ItineraryDialogComponent, {
      data: {
        lines: this.lines(),
        submit: (request: CreateItineraryRequest) => this.itineraryService.create(request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.itineraries.createFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.itineraries.dialog.titleCreate'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.tableState.resetToFirstPage();
        this.loadItineraries();
        this.notify.success(this.transloco.translate('admin.itineraries.createSuccess'));
      }
    });
  }

  openEditDialog(itinerary: Itinerary): void {
    const dialogRef = this.dialog.open(ItineraryDialogComponent, {
      data: {
        itinerary,
        lines: this.lines(),
        submit: (request: CreateItineraryRequest) => this.itineraryService.update(itinerary.id, request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.itineraries.updateFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.itineraries.dialog.titleEdit'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadItineraries();
        this.notify.success(this.transloco.translate('admin.itineraries.updateSuccess'));
      }
    });
  }

  openStopsDialog(itinerary: Itinerary): void {
    const dialogRef = this.dialog.open(ItineraryStopsDialogComponent, {
      data: {
        itinerary,
        submit: (request: UpdateItineraryStopsRequest) => this.itineraryService.updateStops(itinerary.id, request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.itineraries.stopsUpdateFailed')));
        },
      },
      width: '500px',
      ariaLabel: this.transloco.translate('admin.itineraries.stopsDialog.title', { name: itinerary.name }),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadItineraries();
        this.notify.success(this.transloco.translate('admin.itineraries.stopsUpdated'));
      }
    });
  }

  deleteItinerary(itinerary: Itinerary): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.transloco.translate('admin.itineraries.confirm.deleteTitle'),
        message: this.transloco.translate('admin.itineraries.confirm.deleteMessage', { name: itinerary.name }),
        confirmText: this.transloco.translate('common.delete'),
        cancelText: this.transloco.translate('common.cancel'),
        confirmColor: 'warn',
      },
      ariaLabel: this.transloco.translate('admin.itineraries.confirm.deleteTitle'),
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.itineraryService.delete(itinerary.id).subscribe({
          next: () => {
            this.loadItineraries();
            this.notify.success(this.transloco.translate('admin.itineraries.deleteSuccess'));
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.itineraries.deleteFailed')));
          },
        });
      }
    });
  }
}
