import { Component, OnInit, inject, signal, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subject, takeUntil } from 'rxjs';
import { RouteService } from '@core/api/route.service';
import { LineService } from '@core/api/line.service';
import { AuthService } from '@core/auth/auth.service';
import { Route, Line, PageResponse } from '@shared/models';
import { RouteDialogComponent, RouteDialogData } from './route-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { fadeIn } from '@shared/animations';

@Component({
  selector: 'app-routes',
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
    TableSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
  ],
  animations: [fadeIn],
  template: `
    <div class="routes-page">
      <div class="page-header">
        <h1 class="page-title">Routes</h1>
        @if (isAdmin()) {
          <button
            mat-flat-button
            color="primary"
            (click)="openCreateDialog()"
            [disabled]="lines().length === 0"
          >
            <mat-icon>add</mat-icon>
            New Route
          </button>
        }
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="line-filter">
          <mat-label>Filter by Line</mat-label>
          <mat-select [value]="lineId" (selectionChange)="onLineChange($event.value)">
            <mat-option value="">All lines</mat-option>
            @for (line of lines(); track line.id) {
              <mat-option [value]="line.id">
                {{ line.code }} - {{ line.name }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <app-search-input
          placeholder="Search routes..."
          [initialValue]="search"
          (searchChange)="onSearchChange($event)"
        />
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="5"
          [columns]="[{ width: '80px' }, { width: '200px' }, { width: '200px' }, { width: '80px' }]"
        />
      } @else if (lines().length === 0) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="alt_route"
            iconColor="primary"
            title="No lines configured"
            description="Create lines first before adding routes."
          />
        </mat-card>
      } @else if (dataSource.data.length === 0 && !search && !lineId) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="alt_route"
            iconColor="primary"
            title="No routes configured"
            description="Routes define directions on a line (e.g., 'Direction Eastern Terminal')."
            [actionLabel]="isAdmin() ? 'Create Route' : ''"
            [actionIcon]="isAdmin() ? 'add' : ''"
            (action)="openCreateDialog()"
          />
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
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Line</th>
              <td mat-cell *matCellDef="let route">
                <span class="line-badge" [style.backgroundColor]="route.line.color">
                  {{ route.line.code }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Route Name</th>
              <td mat-cell *matCellDef="let route">{{ route.name }}</td>
            </ng-container>

            <ng-container matColumnDef="terminusName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Terminus</th>
              <td mat-cell *matCellDef="let route" class="terminus-cell">
                {{ route.terminusName }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
              <td mat-cell *matCellDef="let route" class="actions-column">
                @if (isAdmin()) {
                  <button mat-icon-button color="primary" (click)="openEditDialog(route)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteRoute(route)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
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
      border-radius: 12px;
      overflow: hidden;
    }

    .line-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 16px;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }

    .terminus-cell {
      font-weight: 500;
      color: var(--app-on-surface);
    }

    .actions-column {
      text-align: right;
      width: 120px;
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
export class RoutesComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly routeService = inject(RouteService);
  private readonly lineService = inject(LineService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  readonly isAdmin = this.authService.isAdmin;

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  lines = signal<Line[]>([]);
  dataSource = new MatTableDataSource<Route>([]);

  // Pagination state
  page = 0;
  size = 10;
  sortBy = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  search = '';
  lineId = '';
  totalElements = 0;

  get displayedColumns(): string[] {
    const columns = ['line', 'name', 'terminusName'];
    if (this.isAdmin()) {
      columns.push('actions');
    }
    return columns;
  }

  ngOnInit(): void {
    this.lineService.getAll().subscribe((lines) => {
      this.lines.set(lines);
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.page = params['page'] ? +params['page'] : 0;
      this.size = params['size'] ? +params['size'] : 10;
      this.sortBy = params['sortBy'] || 'name';
      this.sortDir = params['sortDir'] === 'desc' ? 'desc' : 'asc';
      this.search = params['search'] || '';
      this.lineId = params['lineId'] || '';
      this.loadRoutes();
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

  loadRoutes(): void {
    this.loading.set(true);
    this.routeService
      .getAllPaginated({
        page: this.page,
        size: this.size,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search || undefined,
        lineId: this.lineId || undefined,
      })
      .subscribe({
        next: (response: PageResponse<Route>) => {
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const message = err.error?.message || 'Failed to load routes';
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
    const dialogRef = this.dialog.open(RouteDialogComponent, {
      data: { lines: this.lines() } as RouteDialogData,
      width: '450px',
      ariaLabel: 'Create new route',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.routeService.create(result).subscribe({
          next: () => {
            this.loadRoutes();
            this.snackBar.open('Route created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to create route';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  openEditDialog(route: Route): void {
    const dialogRef = this.dialog.open(RouteDialogComponent, {
      data: { route, lines: this.lines() } as RouteDialogData,
      width: '450px',
      ariaLabel: `Edit route ${route.name}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.routeService.update(route.id, result).subscribe({
          next: () => {
            this.loadRoutes();
            this.snackBar.open('Route updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to update route';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  deleteRoute(route: Route): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Route',
        message: `Delete route "${route.name}" (${route.terminusName})? This will also delete all associated schedule entries.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of route ${route.name}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.routeService.delete(route.id).subscribe({
          next: () => {
            this.loadRoutes();
            this.snackBar.open('Route deleted', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to delete route';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }
}
