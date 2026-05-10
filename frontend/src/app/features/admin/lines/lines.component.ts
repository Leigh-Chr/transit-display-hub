import { ChangeDetectionStrategy, Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { LineService } from '@core/api/line.service';
import { Line, PageResponse, CreateLineRequest } from '@shared/models';
import { LineDialogComponent } from './line-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { httpErrorMessage } from '@shared/utils/http.utils';

@Component({
  selector: 'app-lines',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    CardSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
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
          [initialValue]="tableState.search"
          (searchChange)="tableState.onSearchChange($event)"
        />
        <mat-form-field appearance="outline" class="sort-field">
          <mat-label>Sort by</mat-label>
          <mat-select [(ngModel)]="tableState.sortBy" (selectionChange)="onSortChange()">
            <mat-option value="code">Code (A-Z)</mat-option>
            <mat-option value="code:desc">Code (Z-A)</mat-option>
            <mat-option value="name">Name (A-Z)</mat-option>
            <mat-option value="name:desc">Name (Z-A)</mat-option>
            <mat-option value="stopCount:desc">Most Stops</mat-option>
            <mat-option value="stopCount">Fewest Stops</mat-option>
            <mat-option value="itineraryCount:desc">Most Itineraries</mat-option>
            <mat-option value="itineraryCount">Fewest Itineraries</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <div class="lines-grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-card-skeleton />
          }
        </div>
      } @else if (lines().length === 0 && !tableState.search) {
        <mat-card>
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
      } @else if (lines().length === 0 && tableState.search) {
        <mat-card>
          <app-empty-state
            icon="search_off"
            title="No results found"
            description="Try adjusting your search terms."
          />
        </mat-card>
      } @else {
        <div class="lines-grid" animate.enter="grid-stagger">
          @for (line of lines(); track line.id) {
            <mat-card class="line-card">
              <mat-card-content>
                <div class="line-header">
                  <span class="line-code" [style.backgroundColor]="line.color">
                    {{ line.code }}
                  </span>
                  <div class="line-actions">
                    <button mat-icon-button (click)="openEditDialog(line)" matTooltip="Edit">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteLine(line)" matTooltip="Delete">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
                <h3 class="line-name">{{ line.name }}</h3>
                <div class="line-stats">
                  <div class="stat">
                    <mat-icon>place</mat-icon>
                    <span>{{ line.stopCount }} stops</span>
                  </div>
                  <div class="stat">
                    <mat-icon>directions</mat-icon>
                    <span>{{ line.itineraryCount }} itineraries</span>
                  </div>
                </div>
                <div class="line-tags">
                  @if (line.continuousPickup === 0 || line.continuousDropOff === 0) {
                    <span class="line-tag tag-hop" matTooltip="Continuous pickup/drop-off — passengers can board/alight anywhere along the route">
                      <mat-icon>swap_horiz</mat-icon>
                      Hop-on/hop-off
                    </span>
                  }
                  @if (line.cemvSupport === 1) {
                    <span class="line-tag tag-cemv" matTooltip="Contactless EMV (card-tap) accepted on this line">
                      <mat-icon>contactless</mat-icon>
                      Sans contact
                    </span>
                  } @else if (line.cemvSupport === 2) {
                    <span class="line-tag tag-cemv-ask" matTooltip="cEMV availability varies — ask the operator">
                      <mat-icon>contactless</mat-icon>
                      cEMV variable
                    </span>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>

        <mat-paginator
          [length]="totalElements"
          [pageIndex]="tableState.page"
          [pageSize]="tableState.size"
          [pageSizeOptions]="[8, 12, 24, 48]"
          (page)="tableState.onPageChange($event)"
          showFirstLastButtons
        />
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
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .toolbar app-search-input {
      flex: 1;
    }

    .sort-field {
      min-width: 180px;
    }

    .lines-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--app-gap-grid);
    }

    .line-card {
      border-radius: var(--app-radius-md);
    }

    .line-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .line-code {
      display: inline-block;
      padding: 8px 18px;
      border-radius: var(--app-line-badge-radius);
      color: white;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .line-actions {
      display: flex;
      gap: 4px;
      margin: -8px -8px 0 0;
    }

    .line-name {
      margin: 0 0 16px;
      font-size: 17px;
      font-weight: 600;
      color: var(--app-on-surface);
    }

    .line-stats {
      display: flex;
      gap: var(--app-gap-grid);
      margin-bottom: 16px;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--app-on-surface-variant);
      font-size: 14px;
    }

    .stat mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--app-on-surface-muted);
    }

    .line-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .line-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    .line-tag mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .line-tag.tag-hop {
      background: var(--app-tone-tertiary, rgba(99, 102, 241, 0.14));
      color: var(--app-on-tertiary-container, #4338ca);
    }

    .line-tag.tag-cemv {
      background: var(--app-tone-success, rgba(16, 185, 129, 0.14));
      color: var(--app-on-success-container, #047857);
    }

    .line-tag.tag-cemv-ask {
      background: var(--app-tone-warning, rgba(234, 179, 8, 0.18));
      color: var(--app-on-warning-container, #92400e);
    }

    mat-paginator {
      margin-top: 24px;
      border-radius: var(--app-radius-md);
    }

    mat-card:not(.line-card) {
      border-radius: var(--app-radius-md);
    }

    /* Enter animations defined globally — see styles.scss section 13a */
  `,
})
export class LinesComponent implements OnInit {
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly tableState = inject(AdminTableState);
  loading = signal(true);
  lines = signal<Line[]>([]);
  totalElements = 0;

  ngOnInit(): void {
    this.tableState.init({ sortBy: 'code', size: 12 });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tableState.syncFromQueryParams(params);
      this.loadLines();
    });
  }

  loadLines(): void {
    this.loading.set(true);
    const [field, direction] = this.tableState.sortBy.includes(':')
      ? this.tableState.sortBy.split(':')
      : [this.tableState.sortBy, 'asc'];

    this.lineService
      .getAllPaginated({
        page: this.tableState.page,
        size: this.tableState.size,
        sortBy: field,
        sortDir: direction as 'asc' | 'desc',
        search: this.tableState.search || undefined,
      })
      .subscribe({
        next: (response: PageResponse<Line>) => {
          // After a delete on the last item of a page > 0, the server returns
          // an empty page. Step back instead of showing a blank screen.
          if (response.content.length === 0 && this.tableState.page > 0 && response.totalElements > 0) {
            this.tableState.page = Math.max(0, response.totalPages - 1);
            this.tableState.updateUrl();
            this.loadLines();
            return;
          }
          this.lines.set(response.content);
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const message = httpErrorMessage(err, 'Failed to load lines');
          this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
        },
      });
  }

  onSortChange(): void {
    this.tableState.page = 0;
    this.tableState.updateUrl();
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(LineDialogComponent, {
      data: {},
      width: '450px',
      ariaLabel: 'Create new line',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.lineService.create(result as CreateLineRequest).subscribe({
          next: () => {
            // Jump back to page 0 so the user actually sees the new item
            // (which sorts wherever the active sort dictates).
            this.tableState.resetToFirstPage();
            this.loadLines();
            this.snackBar.open('Line created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const message = httpErrorMessage(err, 'Failed to create line');
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
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
        this.lineService.update(line.id, result as CreateLineRequest).subscribe({
          next: () => {
            this.loadLines();
            this.snackBar.open('Line updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const message = httpErrorMessage(err, 'Failed to update line');
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }

  deleteLine(line: Line): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Line',
        message: `Delete line "${line.name}"? Itineraries, schedules and line-scoped messages will be removed; stops served by this line are kept.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
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
          error: (err: unknown) => {
            const message = httpErrorMessage(err, 'Failed to delete line');
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }
}
