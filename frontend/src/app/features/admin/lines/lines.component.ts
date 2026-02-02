import { Component, OnInit, inject, signal, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Subject, takeUntil } from 'rxjs';
import { LineService } from '@core/api/line.service';
import { Line, PageResponse } from '@shared/models';
import { LineDialogComponent } from './line-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { fadeIn } from '@shared/animations';

@Component({
  selector: 'app-lines',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSortModule,
    MatPaginatorModule,
    TableSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
  ],
  animations: [fadeIn],
  template: `
    <div class="lines-page">
      <div class="page-header">
        <h1 class="page-title">Lines</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          New Line
        </button>
      </div>

      <div class="toolbar">
        <app-search-input
          placeholder="Search lines..."
          [initialValue]="search"
          (searchChange)="onSearchChange($event)"
        />
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="4"
          [columns]="[
            { width: '60px', height: '32px' },
            { width: '150px' },
            { width: '120px' },
            { width: '80px' },
            { width: '80px' }
          ]"
        />
      } @else if (dataSource.data.length === 0 && !search) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="subway"
            iconColor="primary"
            title="No lines configured"
            description="Create your first line to start building your transit network."
            actionLabel="Create Line"
            actionIcon="add"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else if (dataSource.data.length === 0 && search) {
        <mat-card @fadeIn>
          <app-empty-state
            icon="search_off"
            title="No results found"
            description="Try adjusting your search terms."
          />
        </mat-card>
      } @else {
        <mat-card @fadeIn>
          <table mat-table [dataSource]="dataSource" matSort (matSortChange)="onSortChange($event)" class="full-width">
            <ng-container matColumnDef="code">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Code</th>
              <td mat-cell *matCellDef="let line">
                <span class="line-badge" [style.backgroundColor]="line.color">
                  {{ line.code }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
              <td mat-cell *matCellDef="let line">{{ line.name }}</td>
            </ng-container>

            <ng-container matColumnDef="color">
              <th mat-header-cell *matHeaderCellDef class="hide-mobile">Color</th>
              <td mat-cell *matCellDef="let line" class="hide-mobile">
                <div class="color-display">
                  <div class="color-swatch" [style.backgroundColor]="line.color"></div>
                  <span class="color-code">{{ line.color }}</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="stops">
              <th mat-header-cell *matHeaderCellDef mat-sort-header="stopCount">Stops</th>
              <td mat-cell *matCellDef="let line">{{ line.stopCount }} stops</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
              <td mat-cell *matCellDef="let line" class="actions-column">
                <button mat-icon-button color="primary" (click)="openEditDialog(line)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteLine(line)">
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
      margin-bottom: 20px;
    }

    .full-width {
      width: 100%;
    }

    .line-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .color-display {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .color-swatch {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid var(--app-outline);
    }

    .color-code {
      color: var(--app-on-surface-variant);
      font-size: 13px;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    .actions-column {
      text-align: right;
      width: 120px;
    }

    .hide-mobile {
      @media (max-width: 600px) {
        display: none !important;
      }
    }

    mat-card {
      border-radius: 12px;
      overflow: hidden;
    }
  `,
})
export class LinesComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  dataSource = new MatTableDataSource<Line>([]);
  displayedColumns = ['code', 'name', 'color', 'stops', 'actions'];

  // Pagination state
  page = 0;
  size = 10;
  sortBy = 'code';
  sortDir: 'asc' | 'desc' = 'asc';
  search = '';
  totalElements = 0;

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.page = params['page'] ? +params['page'] : 0;
      this.size = params['size'] ? +params['size'] : 10;
      this.sortBy = params['sortBy'] || 'code';
      this.sortDir = params['sortDir'] === 'desc' ? 'desc' : 'asc';
      this.search = params['search'] || '';
      this.loadLines();
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
    this.loading.set(true);
    this.lineService
      .getAllPaginated({
        page: this.page,
        size: this.size,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search || undefined,
      })
      .subscribe({
        next: (response: PageResponse<Line>) => {
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const message = err.error?.message || 'Failed to load lines';
          this.snackBar.open(message, 'Close', { duration: 5000 });
        },
      });
  }

  updateUrl(): void {
    const queryParams: Record<string, string | number> = {};
    if (this.page > 0) queryParams['page'] = this.page;
    if (this.size !== 10) queryParams['size'] = this.size;
    if (this.sortBy !== 'code') queryParams['sortBy'] = this.sortBy;
    if (this.sortDir !== 'asc') queryParams['sortDir'] = this.sortDir;
    if (this.search) queryParams['search'] = this.search;

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

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(LineDialogComponent, {
      data: {},
      width: '450px',
      ariaLabel: 'Create new line',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.lineService.create(result).subscribe({
          next: () => {
            this.loadLines();
            this.snackBar.open('Line created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to create line';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  openEditDialog(line: Line): void {
    const dialogRef = this.dialog.open(LineDialogComponent, {
      data: { line },
      width: '450px',
      ariaLabel: `Edit line ${line.name}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.lineService.update(line.id, result).subscribe({
          next: () => {
            this.loadLines();
            this.snackBar.open('Line updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to update line';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }

  deleteLine(line: Line): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Line',
        message: `Delete line "${line.name}"? This will also delete all associated stops and schedules.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of line ${line.name}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.lineService.delete(line.id).subscribe({
          next: () => {
            this.loadLines();
            this.snackBar.open('Line deleted', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err) => {
            const message = err.error?.message || 'Failed to delete line';
            this.snackBar.open(message, 'Close', { duration: 5000 });
          },
        });
      }
    });
  }
}
