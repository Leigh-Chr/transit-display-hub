import { Component, OnInit, inject, signal, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subject, takeUntil } from 'rxjs';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { Line, Stop, PageResponse } from '@shared/models';
import { StopDialogComponent, StopDialogData } from './stop-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { fadeIn } from '@shared/animations';

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
  ],
  animations: [fadeIn],
  template: `
    <div class="stops-page">
      <div class="page-header">
        <h1 class="page-title">Stops</h1>
        <button
          mat-flat-button
          color="primary"
          (click)="openCreateDialog()"
          [disabled]="lines().length === 0"
        >
          <mat-icon>add</mat-icon>
          New Stop
        </button>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="line-filter">
          <mat-label>Filter by Line</mat-label>
          <mat-select [value]="lineId" (selectionChange)="onLineChange($event.value)">
            <mat-option value="">All Lines</mat-option>
            @for (line of lines(); track line.id) {
              <mat-option [value]="line.id">
                {{ line.code }} - {{ line.name }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <app-search-input
          placeholder="Search stops..."
          [initialValue]="search"
          (searchChange)="onSearchChange($event)"
        />
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
      } @else if (dataSource.data.length === 0 && !search && !lineId) {
        <mat-card @fadeIn>
          @if (lines().length === 0) {
            <app-empty-state
              icon="subway"
              title="Create a line first"
              description="You need to create at least one line before adding stops."
            />
          } @else {
            <app-empty-state
              icon="place"
              iconColor="primary"
              title="No stops found"
              description="Create stops to define passenger boarding points on your lines."
              actionLabel="Create Stop"
              actionIcon="add"
              (action)="openCreateDialog()"
            />
          }
        </mat-card>
      } @else if (dataSource.data.length === 0) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="search_off"
            title="No results found"
            description="Try adjusting your search terms or filter."
          />
        </mat-card>
      } @else {
        <mat-card @fadeIn>
          <table mat-table [dataSource]="dataSource" matSort (matSortChange)="onSortChange($event)" class="full-width">
            <ng-container matColumnDef="line">
              <th mat-header-cell *matHeaderCellDef>Lines</th>
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
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
              <td mat-cell *matCellDef="let stop">{{ stop.name }}</td>
            </ng-container>

            <ng-container matColumnDef="schedules">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="scheduleCount" class="hide-mobile">
                Schedules
              </th>
              <td mat-cell *matCellDef="let stop" class="hide-mobile">{{ stop.scheduleCount }} entries</td>
            </ng-container>

            <ng-container matColumnDef="device">
              <th mat-header-cell *matHeaderCellDef class="device-column">Display</th>
              <td mat-cell *matCellDef="let stop" class="device-column">
                @if (stop.hasDevice) {
                  <mat-icon class="device-active" matTooltip="Display configured">tv</mat-icon>
                } @else {
                  <mat-icon class="device-inactive" matTooltip="No display">tv_off</mat-icon>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
              <td mat-cell *matCellDef="let stop" class="actions-column">
                <button mat-icon-button (click)="openKioskPreview(stop.id)" matTooltip="Preview kiosk display">
                  <mat-icon>visibility</mat-icon>
                </button>
                <button mat-icon-button color="primary" (click)="openEditDialog(stop)" matTooltip="Edit stop">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteStop(stop)" matTooltip="Delete stop">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>

          <mat-paginator
            [length]="totalElements"
            [pageIndex]="page"
            [pageSize]="size"
            [pageSizeOptions]="[5, 10, 25, 50]"
            (page)="onPageChange($event)"
            showFirstLastButtons
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
      font-size: 12px;
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
      font-size: 20px;
    }

    .device-inactive {
      color: var(--app-outline);
      font-size: 20px;
      opacity: 0.5;
    }

    .hide-mobile {
      @media (max-width: 600px) {
        display: none !important;
      }
    }

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
export class StopsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly lineService = inject(LineService);
  private readonly stopService = inject(StopService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  lines = signal<Line[]>([]);
  dataSource = new MatTableDataSource<Stop>([]);
  displayedColumns = ['line', 'name', 'schedules', 'device', 'actions'];

  // Pagination state
  page = 0;
  size = 10;
  sortBy = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  search = '';
  lineId = '';
  totalElements = 0;

  ngOnInit(): void {
    this.loadLines();
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.page = params['page'] ? +params['page'] : 0;
      this.size = params['size'] ? +params['size'] : 10;
      this.sortBy = params['sortBy'] || 'name';
      this.sortDir = params['sortDir'] === 'desc' ? 'desc' : 'asc';
      this.search = params['search'] || '';
      this.lineId = params['lineId'] || '';
      this.loadStops();
    });
  }

  ngAfterViewInit(): void {
    const sortRef = this.sort();
    if (sortRef) {
      sortRef.active = this.sortBy;
      sortRef.direction = this.sortDir;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLines(): void {
    this.lineService.getAll().subscribe((lines) => this.lines.set(lines));
  }

  loadStops(): void {
    this.loading.set(true);
    this.stopService
      .getAllPaginated({
        page: this.page,
        size: this.size,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search || undefined,
        lineId: this.lineId || undefined,
      })
      .subscribe({
        next: (response: PageResponse<Stop>) => {
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const message = err.error?.message || 'Failed to load stops';
          this.snackBar.open(message, 'Close', { duration: 5000 });
        },
      });
  }

  updateUrl(): void {
    const queryParams: Record<string, string | number> = {};
    if (this.page > 0) queryParams['page'] = this.page;
    if (this.size !== 10) queryParams['size'] = this.size;
    if (this.sortBy !== 'name') queryParams['sortBy'] = this.sortBy;
    if (this.sortDir !== 'asc') queryParams['sortDir'] = this.sortDir;
    if (this.search) queryParams['search'] = this.search;
    if (this.lineId) queryParams['lineId'] = this.lineId;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex;
    this.size = event.pageSize;
    this.updateUrl();
  }

  onSortChange(event: Sort): void {
    this.sortBy = event.active;
    this.sortDir = event.direction === 'desc' ? 'desc' : 'asc';
    this.page = 0;
    this.updateUrl();
  }

  onSearchChange(search: string): void {
    this.search = search;
    this.page = 0;
    this.updateUrl();
  }

  onLineChange(lineId: string): void {
    this.lineId = lineId;
    this.page = 0;
    this.updateUrl();
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(StopDialogComponent, {
      data: {
        lines: this.lines(),
        selectedLineId: this.lineId,
      } as StopDialogData,
      width: '450px',
      ariaLabel: 'Create new stop',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.stopService.create(result).subscribe({
          next: () => {
            this.loadStops();
            this.snackBar.open('Stop created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to create stop';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  openEditDialog(stop: Stop): void {
    const dialogRef = this.dialog.open(StopDialogComponent, {
      data: {
        stop,
        lines: this.lines(),
      } as StopDialogData,
      width: '450px',
      ariaLabel: `Edit stop ${stop.name}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.stopService.update(stop.id, result).subscribe({
          next: () => {
            this.loadStops();
            this.snackBar.open('Stop updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to update stop';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  deleteStop(stop: Stop): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Stop',
        message: `Delete stop "${stop.name}"? This will also delete all associated schedules.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of stop ${stop.name}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.stopService.delete(stop.id).subscribe({
          next: () => {
            this.loadStops();
            this.snackBar.open('Stop deleted', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to delete stop';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  openKioskPreview(stopId: string): void {
    window.open(`/display/${stopId}`, '_blank');
  }
}
