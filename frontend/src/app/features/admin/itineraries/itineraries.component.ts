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
  template: `
    <ng-container *transloco="let t">
    <div class="itineraries-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.itineraries.title') }}</h1>
        @if (isAdmin()) {
          <button
            mat-flat-button
            color="primary"
            (click)="openCreateDialog()"
            [disabled]="lines().length === 0"
          >
            <mat-icon>add</mat-icon>
            {{ t('admin.itineraries.newItinerary') }}
          </button>
        }
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="line-filter">
          <mat-label>{{ t('admin.itineraries.filterByLine') }}</mat-label>
          <mat-select [value]="lineId()" (selectionChange)="onLineChange($event.value)">
            <mat-option value="">{{ t('admin.itineraries.allLines') }}</mat-option>
            @for (line of lines(); track line.id) {
              <mat-option [value]="line.id">
                {{ line.code }} - {{ line.name }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <app-search-input
          [placeholder]="t('admin.itineraries.searchPlaceholder')"
          [initialValue]="tableState.search"
          (searchChange)="tableState.onSearchChange($event)"
        />
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="5"
          [columns]="[{ width: '80px' }, { width: '200px' }, { width: '150px' }, { width: '200px' }, { width: '80px' }]"
        />
      } @else if (loadError()) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="error_outline"
            [title]="t('admin.itineraries.loadFailed')"
            [description]="t('admin.common.loadErrorDescription')"
            [actionLabel]="t('common.refresh')"
            actionIcon="refresh"
            (action)="loadItineraries()"
          />
        </mat-card>
      } @else if (lines().length === 0) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="route"
            iconColor="primary"
            [title]="t('admin.itineraries.emptyNoLinesTitle')"
            [description]="t('admin.itineraries.emptyNoLinesDesc')"
          />
        </mat-card>
      } @else if (itineraries().length === 0 && !tableState.search && !lineId()) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="route"
            iconColor="primary"
            [title]="t('admin.itineraries.emptyTitle')"
            [description]="t('admin.itineraries.emptyDescription')"
            [actionLabel]="isAdmin() ? t('admin.itineraries.emptyAction') : ''"
            [actionIcon]="isAdmin() ? 'add' : ''"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else if (itineraries().length === 0) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="search_off"
            [title]="t('admin.itineraries.emptySearchTitle')"
            [description]="t('admin.itineraries.emptySearchDescription')"
          />
        </mat-card>
      } @else {
        <mat-card animate.enter="fade-in">
          <table mat-table [dataSource]="itineraries()" matSort (matSortChange)="tableState.onSortChange($event)" class="full-width">
            <ng-container matColumnDef="line">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ t('admin.itineraries.colLine') }}</th>
              <td mat-cell *matCellDef="let itinerary">
                <span class="line-badge" [style.backgroundColor]="itinerary.line.color">
                  {{ itinerary.line.code }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ t('admin.itineraries.colName') }}</th>
              <td mat-cell *matCellDef="let itinerary">{{ itinerary.name }}</td>
            </ng-container>

            <ng-container matColumnDef="terminusName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ t('admin.itineraries.colTerminus') }}</th>
              <td mat-cell *matCellDef="let itinerary" class="terminus-cell">
                {{ itinerary.terminusName || t('admin.itineraries.noStops') }}
              </td>
            </ng-container>

            <ng-container matColumnDef="direction">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.itineraries.colDirection') }}</th>
              <td mat-cell *matCellDef="let itinerary">
                @if (itinerary.directionId === 0) {
                  <span class="dir-badge dir-out" matTooltip="GTFS direction_id = 0 (outbound)">→ Aller</span>
                } @else if (itinerary.directionId === 1) {
                  <span class="dir-badge dir-back" matTooltip="GTFS direction_id = 1 (inbound)">← Retour</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="stops">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.itineraries.colStops') }}</th>
              <td mat-cell *matCellDef="let itinerary">
                <span class="stop-count">{{ t('admin.itineraries.stopCount', { count: itinerary.stops?.length || 0 }) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="amenities">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.itineraries.colAmenities') }}</th>
              <td mat-cell *matCellDef="let itinerary">
                @if (itinerary.carsAllowedDefault === 'ALLOWED') {
                  <span class="dir-badge amenity-cars" [matTooltip]="t('admin.itineraries.carsAllowedTooltip')">
                    🚗 Voitures
                  </span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">{{ t('admin.itineraries.colActions') }}</th>
              <td mat-cell *matCellDef="let itinerary" class="actions-column">
                @if (isAdmin()) {
                  <button mat-icon-button color="primary" (click)="openEditDialog(itinerary)" [matTooltip]="t('admin.itineraries.editTooltip')">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="accent" (click)="openStopsDialog(itinerary)" [matTooltip]="t('admin.itineraries.editStopsTooltip')">
                    <mat-icon>reorder</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteItinerary(itinerary)" [matTooltip]="t('admin.itineraries.deleteTooltip')">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>

          <mat-paginator
            [length]="totalElements()"
            [pageIndex]="tableState.page"
            [pageSize]="tableState.size"
            [pageSizeOptions]="pageSizeOptions"
            (page)="tableState.onPageChange($event)"
            showFirstLastButtons
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

    .toolbar {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .line-filter {
      width: 300px;
    }

    .full-width {
      width: 100%;
    }

    mat-card {
      border-radius: var(--app-radius-md);
      overflow: hidden;
    }

    .line-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: var(--app-line-badge-radius);
      color: white;
      font-size: 12px;
      font-weight: 600;
    }

    .terminus-cell {
      font-weight: 500;
      color: var(--app-on-surface);
    }

    .stop-count {
      color: var(--app-on-surface-muted);
      font-size: 13px;
    }

    .dir-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
    }

    .dir-out {
      background: rgba(99, 102, 241, 0.14);
      color: #4338ca;
    }

    .dir-back {
      background: rgba(244, 114, 182, 0.16);
      color: #be185d;
    }

    .amenity-cars {
      background: rgba(16, 185, 129, 0.14);
      color: #047857;
    }

    .actions-column {
      text-align: right;
      width: var(--app-actions-column-width);
    }

    /* Enter animations defined globally — see styles.scss section 13a */

    @media (max-width: 600px) {
      .toolbar {
        flex-direction: column;
      }

      .line-filter {
        width: 100%;
      }
    }
  `,
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
