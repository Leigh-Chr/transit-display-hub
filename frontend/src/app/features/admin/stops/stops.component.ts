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
  template: `
    <ng-container *transloco="let t">
    <div class="stops-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.stops.title') }}</h1>
        <button
          mat-flat-button
          color="primary"
          (click)="openCreateDialog()"
          [disabled]="lines().length === 0"
        >
          <mat-icon>add</mat-icon>
          {{ t('admin.stops.newStop') }}
        </button>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="line-filter">
          <mat-label>{{ t('admin.stops.filterByLine') }}</mat-label>
          <mat-select [value]="lineId()" (selectionChange)="onLineChange($event.value)">
            <mat-option value="">{{ t('admin.stops.allLines') }}</mat-option>
            @for (line of lines(); track line.id) {
              <mat-option [value]="line.id">
                {{ line.code }} - {{ line.name }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <app-search-input
          [placeholder]="t('admin.stops.searchPlaceholder')"
          [initialValue]="tableState.search"
          (searchChange)="tableState.onSearchChange($event)"
        />

        <button
          mat-stroked-button
          (click)="openHubDisplay()"
          [matTooltip]="t('admin.stops.hubDisplayTooltip')"
        >
          <mat-icon>hub</mat-icon>
          {{ t('admin.stops.hubDisplay') }}
        </button>
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="5"
          [columns]="[
            { width: '60px', height: '32px' },
            { width: '180px' },
            { width: '100px' },
            { width: '60px' },
            { width: '80px' }
          ]"
        />
      } @else if (loadError()) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="error_outline"
            [title]="t('admin.stops.loadFailed')"
            [description]="t('admin.common.loadErrorDescription')"
            [actionLabel]="t('common.refresh')"
            actionIcon="refresh"
            (action)="loadStops()"
          />
        </mat-card>
      } @else if (stops().length === 0 && !tableState.search && !lineId()) {
        <mat-card animate.enter="fade-in">
          @if (lines().length === 0) {
            <app-empty-state
              icon="subway"
              [title]="t('admin.stops.emptyNoLines')"
              [description]="t('admin.stops.emptyNoLinesDesc')"
            />
          } @else {
            <app-empty-state
              icon="place"
              iconColor="primary"
              [title]="t('admin.stops.emptyTitle')"
              [description]="t('admin.stops.emptyDescription')"
              [actionLabel]="t('admin.stops.emptyAction')"
              actionIcon="add"
              (action)="openCreateDialog()"
            />
          }
        </mat-card>
      } @else if (stops().length === 0) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="search_off"
            [title]="t('admin.stops.emptySearchTitle')"
            [description]="t('admin.stops.emptySearchDescription')"
          />
        </mat-card>
      } @else {
        <mat-card animate.enter="fade-in">
          <table mat-table matSort [dataSource]="stops()" (matSortChange)="tableState.onSortChange($event)" class="full-width">
            <ng-container matColumnDef="line">
              <th mat-header-cell *matHeaderCellDef>{{ t('admin.stops.colLines') }}</th>
              <td mat-cell *matCellDef="let stop">
                <div class="line-badges">
                  @for (line of stop.lines; track line.id) {
                    <span class="line-badge" [style.backgroundColor]="line.color">
                      {{ line.code }}
                    </span>
                  }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ t('admin.stops.colName') }}</th>
              <td mat-cell *matCellDef="let stop">
                <span class="stop-name-cell">
                  @if (stop.locationType === 1) {
                    <mat-icon class="stop-type-icon" matTooltip="Station (parent)">apartment</mat-icon>
                  }
                  <span>{{ stop.name }}</span>
                  @if (stop.platformCode) {
                    <span class="platform-badge" matTooltip="Quai">{{ stop.platformCode }}</span>
                  }
                  @if (stop.zoneId) {
                    <span class="zone-badge" matTooltip="GTFS fare zone (origin/destination/contains_id)">
                      Zone {{ stop.zoneId }}
                    </span>
                  }
                  @if (stop.stopAccess === 1) {
                    <span class="access-restricted" matTooltip="GTFS stop_access = 1 (staff-only)">
                      <mat-icon>lock</mat-icon> Personnel
                    </span>
                  }
                  @if (stop.parentStopName) {
                    <span class="parent-hint" matTooltip="Rattaché à">— {{ stop.parentStopName }}</span>
                  }
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="schedules">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="scheduleCount" class="hide-mobile">
                {{ t('admin.stops.colSchedules') }}
              </th>
              <td mat-cell *matCellDef="let stop" class="hide-mobile">{{ t('admin.stops.colSchedulesEntries', { count: stop.scheduleCount }) }}</td>
            </ng-container>

            <ng-container matColumnDef="device">
              <th mat-header-cell *matHeaderCellDef class="device-column">{{ t('admin.stops.colDisplay') }}</th>
              <td mat-cell *matCellDef="let stop" class="device-column">
                @if (stop.hasDevice) {
                  <mat-icon class="device-active" [matTooltip]="t('admin.stops.displayConfigured')">tv</mat-icon>
                } @else {
                  <mat-icon class="device-inactive" [matTooltip]="t('admin.stops.noDisplay')">tv_off</mat-icon>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">{{ t('admin.common.actions') }}</th>
              <td mat-cell *matCellDef="let stop" class="actions-column">
                <button mat-icon-button (click)="openKioskPreview(stop.id)"
                        [matTooltip]="t('admin.stops.previewTooltip')"
                        [attr.aria-label]="t('admin.stops.previewTooltip')">
                  <mat-icon>visibility</mat-icon>
                </button>
                <button mat-icon-button color="primary" (click)="openEditDialog(stop)"
                        [matTooltip]="t('admin.stops.editTooltip')"
                        [attr.aria-label]="t('admin.stops.editTooltip')">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteStop(stop)"
                        [matTooltip]="t('admin.stops.deleteTooltip')"
                        [attr.aria-label]="t('admin.stops.deleteTooltip')">
                  <mat-icon>delete</mat-icon>
                </button>
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
      font-size: var(--m3-type-headline-large);
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

    .line-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .line-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: var(--app-line-badge-radius);
      color: white;
      font-size: var(--m3-type-label-medium);
      font-weight: 600;
    }

    .actions-column {
      text-align: right;
      width: var(--app-actions-column-width);
    }

    .device-column {
      width: 80px;
      text-align: center;
    }

    .device-active {
      color: var(--app-primary);
      font-size: var(--m3-type-headline-small);
    }

    .device-inactive {
      color: var(--app-outline);
      font-size: var(--m3-type-headline-small);
      opacity: 0.5;
    }

    .hide-mobile {
      @media (max-width: 600px) {
        display: none !important;
      }
    }

    .stop-name-cell {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .stop-type-icon {
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
      color: var(--mat-sys-primary);
    }

    .platform-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 4px;
      font-size: var(--m3-type-label-medium);
      font-weight: 600;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font-variant-numeric: tabular-nums;
    }

    .zone-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 4px;
      font-size: var(--m3-type-label-small);
      font-weight: 500;
      background: rgba(99, 102, 241, 0.14);
      color: #4338ca;
      font-variant-numeric: tabular-nums;
    }

    .access-restricted {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 8px;
      border-radius: 4px;
      font-size: var(--m3-type-label-small);
      font-weight: 500;
      background: rgba(244, 114, 182, 0.18);
      color: #be185d;
    }

    .access-restricted mat-icon {
      font-size: var(--m3-type-body-small);
      width: 13px;
      height: 13px;
    }

    .parent-hint {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85em;
      font-style: italic;
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
