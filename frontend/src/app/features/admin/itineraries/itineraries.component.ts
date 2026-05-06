import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild, AfterViewInit, OnDestroy } from '@angular/core';
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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { ItineraryService } from '@core/api/itinerary.service';
import { LineService } from '@core/api/line.service';
import { AuthService } from '@core/auth/auth.service';
import { Itinerary, Line, PageResponse, UpdateItineraryStopsRequest, CreateItineraryRequest } from '@shared/models';
import { ItineraryDialogComponent, ItineraryDialogData } from './itinerary-dialog.component';
import { ItineraryStopsDialogComponent, ItineraryStopsDialogData } from './itinerary-stops-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="itineraries-page">
      <div class="page-header">
        <h1 class="page-title">Itineraries</h1>
        @if (isAdmin()) {
          <button
            mat-flat-button
            color="primary"
            (click)="openCreateDialog()"
            [disabled]="lines().length === 0"
          >
            <mat-icon>add</mat-icon>
            New Itinerary
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
          placeholder="Search itineraries..."
          [initialValue]="search"
          (searchChange)="onSearchChange($event)"
        />
      </div>

      @if (loading()) {
        <app-table-skeleton
          [rows]="5"
          [columns]="[{ width: '80px' }, { width: '200px' }, { width: '150px' }, { width: '200px' }, { width: '80px' }]"
        />
      } @else if (lines().length === 0) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="route"
            iconColor="primary"
            title="No lines configured"
            description="Create lines first before adding itineraries."
          />
        </mat-card>
      } @else if (dataSource.data.length === 0 && !search && !lineId) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="route"
            iconColor="primary"
            title="No itineraries configured"
            description="Itineraries define ordered sequences of stops for each direction on a line."
            [actionLabel]="isAdmin() ? 'Create Itinerary' : ''"
            [actionIcon]="isAdmin() ? 'add' : ''"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else if (dataSource.data.length === 0) {
        <mat-card animate.enter="fade-in">
          <app-empty-state
            icon="search_off"
            title="No results found"
            description="Try adjusting your search terms or filter."
          />
        </mat-card>
      } @else {
        <mat-card animate.enter="fade-in">
          <table mat-table [dataSource]="dataSource" matSort (matSortChange)="onSortChange($event)" class="full-width">
            <ng-container matColumnDef="line">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Line</th>
              <td mat-cell *matCellDef="let itinerary">
                <span class="line-badge" [style.backgroundColor]="itinerary.line.color">
                  {{ itinerary.line.code }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Itinerary Name</th>
              <td mat-cell *matCellDef="let itinerary">{{ itinerary.name }}</td>
            </ng-container>

            <ng-container matColumnDef="terminusName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Terminus</th>
              <td mat-cell *matCellDef="let itinerary" class="terminus-cell">
                {{ itinerary.terminusName || '(no stops)' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="stops">
              <th mat-header-cell *matHeaderCellDef>Stops</th>
              <td mat-cell *matCellDef="let itinerary">
                <span class="stop-count">{{ itinerary.stops?.length || 0 }} stops</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-column">Actions</th>
              <td mat-cell *matCellDef="let itinerary" class="actions-column">
                @if (isAdmin()) {
                  <button mat-icon-button color="primary" (click)="openEditDialog(itinerary)" matTooltip="Edit itinerary">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="accent" (click)="openStopsDialog(itinerary)" matTooltip="Manage stops">
                    <mat-icon>reorder</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteItinerary(itinerary)" matTooltip="Delete">
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
export class ItinerariesComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly itineraryService = inject(ItineraryService);
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
  dataSource = new MatTableDataSource<Itinerary>([]);

  // Pagination state
  page = 0;
  size = 10;
  sortBy = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  search = '';
  lineId = '';
  totalElements = 0;

  get displayedColumns(): string[] {
    const columns = ['line', 'name', 'terminusName', 'stops'];
    if (this.isAdmin()) {
      columns.push('actions');
    }
    return columns;
  }

  ngOnInit(): void {
    this.lineService.getAll().subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.snackBar.open('Failed to load lines', 'Close', { duration: 5000, panelClass: 'error-snackbar' }),
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.page = params['page'] ? +params['page'] : 0;
      this.size = params['size'] ? +params['size'] : 10;
      this.sortBy = (params['sortBy'] as string | undefined) ?? 'name';
      this.sortDir = params['sortDir'] === 'desc' ? 'desc' : 'asc';
      this.search = (params['search'] as string | undefined) ?? '';
      this.lineId = (params['lineId'] as string | undefined) ?? '';
      this.loadItineraries();
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

  loadItineraries(): void {
    this.loading.set(true);
    this.itineraryService
      .getAllPaginated({
        page: this.page,
        size: this.size,
        sortBy: this.sortBy,
        sortDir: this.sortDir,
        search: this.search || undefined,
        lineId: this.lineId || undefined,
      })
      .subscribe({
        next: (response: PageResponse<Itinerary>) => {
          if (response.content.length === 0 && this.page > 0 && response.totalElements > 0) {
            this.page = Math.max(0, response.totalPages - 1);
            this.updateUrl();
            this.loadItineraries();
            return;
          }
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const httpErr = err as { error?: { message?: string } };
          const message = httpErr.error?.message ?? 'Failed to load itineraries';
          this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
        },
      });
  }

  updateUrl(): void {
    const queryParams: Record<string, string | number> = {};
    if (this.page > 0) {queryParams['page'] = this.page;}
    if (this.size !== 10) {queryParams['size'] = this.size;}
    if (this.sortBy !== 'name') {queryParams['sortBy'] = this.sortBy;}
    if (this.sortDir !== 'asc') {queryParams['sortDir'] = this.sortDir;}
    if (this.search) {queryParams['search'] = this.search;}
    if (this.lineId) {queryParams['lineId'] = this.lineId;}

    void this.router.navigate([], {
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
    const dialogRef = this.dialog.open(ItineraryDialogComponent, {
      data: { lines: this.lines() } as ItineraryDialogData,
      width: '450px',
      ariaLabel: 'Create new itinerary',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.itineraryService.create(result as CreateItineraryRequest).subscribe({
          next: () => {
            this.page = 0;
            this.updateUrl();
            this.loadItineraries();
            this.snackBar.open('Itinerary created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const message = httpErr.error?.message ?? 'Failed to create itinerary';
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }

  openEditDialog(itinerary: Itinerary): void {
    const dialogRef = this.dialog.open(ItineraryDialogComponent, {
      data: { itinerary, lines: this.lines() } as ItineraryDialogData,
      width: '450px',
      ariaLabel: `Edit itinerary ${itinerary.name}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.itineraryService.update(itinerary.id, result as CreateItineraryRequest).subscribe({
          next: () => {
            this.loadItineraries();
            this.snackBar.open('Itinerary updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const message = httpErr.error?.message ?? 'Failed to update itinerary';
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }

  openStopsDialog(itinerary: Itinerary): void {
    const dialogRef = this.dialog.open(ItineraryStopsDialogComponent, {
      data: { itinerary } as ItineraryStopsDialogData,
      width: '500px',
      ariaLabel: `Manage stops for itinerary ${itinerary.name}`,
    });

    dialogRef.afterClosed().subscribe((result: UpdateItineraryStopsRequest | undefined) => {
      if (result) {
        this.itineraryService.updateStops(itinerary.id, result).subscribe({
          next: () => {
            this.loadItineraries();
            this.snackBar.open('Stops updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const message = httpErr.error?.message ?? 'Failed to update stops';
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }

  deleteItinerary(itinerary: Itinerary): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Itinerary',
        message: `Delete itinerary "${itinerary.name}"? This will also delete all associated schedules.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of itinerary ${itinerary.name}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.itineraryService.delete(itinerary.id).subscribe({
          next: () => {
            this.loadItineraries();
            this.snackBar.open('Itinerary deleted', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const message = httpErr.error?.message ?? 'Failed to delete itinerary';
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }
}
