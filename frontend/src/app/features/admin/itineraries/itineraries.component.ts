import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild, AfterViewInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
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
import { Itinerary, Line, PageResponse, UpdateItineraryStopsRequest, CreateItineraryRequest } from '@shared/models';
import { ItineraryDialogComponent } from './itinerary-dialog.component';
import { ItineraryStopsDialogComponent } from './itinerary-stops-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { TableSkeletonComponent } from '@shared/components/skeleton/table-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { httpErrorMessage } from '@shared/utils/http.utils';

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
  providers: [AdminTableState],
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
          [initialValue]="tableState.search"
          (searchChange)="tableState.onSearchChange($event)"
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
      } @else if (dataSource.data.length === 0 && !tableState.search && !lineId) {
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
          <table mat-table [dataSource]="dataSource" matSort (matSortChange)="tableState.onSortChange($event)" class="full-width">
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

            <ng-container matColumnDef="direction">
              <th mat-header-cell *matHeaderCellDef>Direction</th>
              <td mat-cell *matCellDef="let itinerary">
                @if (itinerary.directionId === 0) {
                  <span class="dir-badge dir-out" matTooltip="GTFS direction_id = 0 (outbound)">→ Aller</span>
                } @else if (itinerary.directionId === 1) {
                  <span class="dir-badge dir-back" matTooltip="GTFS direction_id = 1 (inbound)">← Retour</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="stops">
              <th mat-header-cell *matHeaderCellDef>Stops</th>
              <td mat-cell *matCellDef="let itinerary">
                <span class="stop-count">{{ itinerary.stops?.length || 0 }} stops</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="amenities">
              <th mat-header-cell *matHeaderCellDef>Amenities</th>
              <td mat-cell *matCellDef="let itinerary">
                @if (itinerary.carsAllowedDefault === 'ALLOWED') {
                  <span class="dir-badge amenity-cars" matTooltip="Cars allowed on this trip (motorail / car-ferry)">
                    🚗 Voitures
                  </span>
                }
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
            [pageIndex]="tableState.page"
            [pageSize]="tableState.size"
            [pageSizeOptions]="[5, 10, 25, 50]"
            (page)="tableState.onPageChange($event)"
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
export class ItinerariesComponent implements OnInit, AfterViewInit {
  private readonly itineraryService = inject(ItineraryService);
  private readonly lineService = inject(LineService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly isAdmin = this.authService.isAdmin;
  readonly tableState = inject(AdminTableState);

  readonly sort = viewChild(MatSort);
  loading = signal(true);
  lines = signal<Line[]>([]);
  dataSource = new MatTableDataSource<Itinerary>([]);

  lineId = '';
  totalElements = 0;

  get displayedColumns(): string[] {
    const columns = ['line', 'name', 'terminusName', 'direction', 'stops', 'amenities'];
    if (this.isAdmin()) {
      columns.push('actions');
    }
    return columns;
  }

  ngOnInit(): void {
    this.tableState.init({
      sortBy: 'name',
      extras: () => ({ lineId: this.lineId }),
    });

    this.lineService.getAll().subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.notify.error('Failed to load lines'),
    });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tableState.syncFromQueryParams(params);
      this.lineId = (params['lineId'] as string | undefined) ?? '';
      this.loadItineraries();
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
    this.loading.set(true);
    this.itineraryService
      .getAllPaginated({
        page: this.tableState.page,
        size: this.tableState.size,
        sortBy: this.tableState.sortBy,
        sortDir: this.tableState.sortDir,
        search: this.tableState.search || undefined,
        lineId: this.lineId || undefined,
      })
      .subscribe({
        next: (response: PageResponse<Itinerary>) => {
          if (response.content.length === 0 && this.tableState.page > 0 && response.totalElements > 0) {
            this.tableState.page = Math.max(0, response.totalPages - 1);
            this.tableState.updateUrl();
            this.loadItineraries();
            return;
          }
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.notify.error(httpErrorMessage(err, 'Failed to load itineraries'));
        },
      });
  }

  onLineChange(lineId: string): void {
    this.lineId = lineId;
    this.tableState.resetToFirstPage();
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(ItineraryDialogComponent, {
      data: { lines: this.lines() },
      width: '450px',
      ariaLabel: 'Create new itinerary',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.itineraryService.create(result as CreateItineraryRequest).subscribe({
          next: () => {
            this.tableState.resetToFirstPage();
            this.loadItineraries();
            this.notify.success('Itinerary created');
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, 'Failed to create itinerary'));
          },
        });
      }
    });
  }

  openEditDialog(itinerary: Itinerary): void {
    const dialogRef = this.dialog.open(ItineraryDialogComponent, {
      data: { itinerary, lines: this.lines() },
      width: '450px',
      ariaLabel: `Edit itinerary ${itinerary.name}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.itineraryService.update(itinerary.id, result as CreateItineraryRequest).subscribe({
          next: () => {
            this.loadItineraries();
            this.notify.success('Itinerary updated');
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, 'Failed to update itinerary'));
          },
        });
      }
    });
  }

  openStopsDialog(itinerary: Itinerary): void {
    const dialogRef = this.dialog.open(ItineraryStopsDialogComponent, {
      data: { itinerary },
      width: '500px',
      ariaLabel: `Manage stops for itinerary ${itinerary.name}`,
    });

    dialogRef.afterClosed().subscribe((result: UpdateItineraryStopsRequest | undefined) => {
      if (result) {
        this.itineraryService.updateStops(itinerary.id, result).subscribe({
          next: () => {
            this.loadItineraries();
            this.notify.success('Stops updated');
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, 'Failed to update stops'));
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
      },
      ariaLabel: `Confirm deletion of itinerary ${itinerary.name}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.itineraryService.delete(itinerary.id).subscribe({
          next: () => {
            this.loadItineraries();
            this.notify.success('Itinerary deleted');
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, 'Failed to delete itinerary'));
          },
        });
      }
    });
  }
}
