import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { LineService } from '@core/api/line.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { Line, CreateLineRequest } from '@shared/models';
import { LineDialogComponent } from './line-dialog.component';
import { TranslocoDirective, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { createAdminListResource } from '@shared/admin/admin-list-resource';
import { confirmAndDelete } from '@shared/admin/confirm-and-delete';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { ADMIN_PAGE_SIZE_OPTIONS } from '@shared/utils/pagination.constants';

@Component({
  selector: 'app-lines',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    RouterLink,
    CardSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
    TranslocoDirective,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
  templateUrl: './lines.component.html',
  styleUrl: './lines.component.scss',
})
export class LinesComponent {
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  readonly tableState = inject(AdminTableState);
  protected readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;

  private readonly list = createAdminListResource<Line>({
    tableState: this.tableState,
    defaults: { sortBy: 'code', size: 12 },
    fetch: (request) => this.lineService.getAllPaginated(request),
  });

  readonly loading = this.list.loading;
  readonly loadError = this.list.loadError;
  readonly lines = this.list.items;
  readonly totalElements = this.list.totalElements;

  /** Multi-select state — Set of line ids currently checked in the
   *  grid. Stays in memory only (intentionally drops on page change /
   *  refresh) so the user doesn't accidentally delete rows they no
   *  longer see. */
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectionCount = computed(() => this.selectedIds().size);
  readonly allCurrentSelected = computed(() => {
    const rows = this.lines();
    if (rows.length === 0) {return false;}
    const set = this.selectedIds();
    return rows.every((l) => set.has(l.id));
  });
  readonly someCurrentSelected = computed(() => {
    const set = this.selectedIds();
    return this.lines().some((l) => set.has(l.id)) && !this.allCurrentSelected();
  });

  loadLines(): void {
    this.list.reload();
  }

  onSortChange(): void {
    this.tableState.page = 0;
    this.tableState.updateUrl();
  }

  toggleSelection(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedIds.set(next);
  }

  toggleSelectAllOnPage(checked: boolean): void {
    const next = new Set(this.selectedIds());
    for (const line of this.lines()) {
      if (checked) {
        next.add(line.id);
      } else {
        next.delete(line.id);
      }
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /** Bulk delete via parallel forkJoin — no backend endpoint exists
   *  for this (each line still goes through the per-id DELETE), but
   *  the UI gives the operator a single confirm step instead of N. */
  bulkDeleteSelected(): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) {return;}

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.transloco.translate('admin.lines.confirm.bulkDeleteTitle'),
        message: this.transloco.translate('admin.lines.confirm.bulkDeleteMessage', { count: ids.length }),
        confirmText: this.transloco.translate('admin.lines.confirm.bulkDeleteConfirm'),
        cancelText: this.transloco.translate('common.cancel'),
        confirmColor: 'warn',
      },
      ariaLabel: this.transloco.translate('admin.lines.confirm.bulkDeleteTitle'),
    });

    ref.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (!confirmed) {return;}
      forkJoin(ids.map((id) => this.lineService.delete(id))).subscribe({
        next: () => {
          this.notify.success(this.transloco.translate('admin.lines.bulkDeleteSuccess', { count: ids.length }));
          this.clearSelection();
          this.loadLines();
        },
        error: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.lines.bulkDeleteFailed')));
          // Partial failure can happen because forkJoin aborts on the
          // first error; reload to surface whatever did go through and
          // drop stale ids from the selection.
          this.clearSelection();
          this.loadLines();
        },
      });
    });
  }

  /**
   * Client-side CSV export of every line. Uses the non-paginated
   * {@code getAll()} so a 200-line network downloads in one shot.
   * The format matches the visible columns (code, name, type, color,
   * stop count, itinerary count) so an operator can reconcile against
   * an external spreadsheet without server help.
   */
  exportCsv(): void {
    this.lineService.getAll().subscribe({
      next: (lines) => {
        const header = ['code', 'name', 'type', 'color', 'stopCount', 'itineraryCount'];
        const rows = lines.map((l) => [
          l.code,
          l.name,
          l.type ?? '',
          l.color,
          String(l.stopCount),
          String(l.itineraryCount),
        ]);
        const csv = [header, ...rows].map(toCsvRow).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lines-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        this.notify.success(this.transloco.translate('admin.lines.exportSuccess', { count: lines.length }));
      },
      error: (err: unknown) => {
        this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.lines.exportFailed')));
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(LineDialogComponent, {
      data: {
        submit: (request: CreateLineRequest) => this.lineService.create(request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.lines.createFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.lines.dialog.titleCreate'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Jump back to page 0 so the user actually sees the new item
        // (which sorts wherever the active sort dictates).
        this.tableState.resetToFirstPage();
        this.loadLines();
        this.notify.success(this.transloco.translate('admin.lines.createSuccess'));
      }
    });
  }

  openEditDialog(line: Line): void {
    const dialogRef = this.dialog.open(LineDialogComponent, {
      data: {
        line,
        submit: (request: CreateLineRequest) => this.lineService.update(line.id, request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.lines.updateFailed')));
        },
      },
      width: '450px',
      ariaLabel: this.transloco.translate('admin.lines.dialog.titleEdit'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadLines();
        this.notify.success(this.transloco.translate('admin.lines.updateSuccess'));
      }
    });
  }

  deleteLine(line: Line): void {
    confirmAndDelete(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        titleKey: 'admin.lines.confirm.deleteTitle',
        messageKey: 'admin.lines.confirm.deleteMessage',
        messageArgs: { name: line.name },
        successKey: 'admin.lines.deleteSuccess',
        errorKey: 'admin.lines.deleteFailed',
        delete$: () => this.lineService.delete(line.id),
        onSuccess: () => this.loadLines(),
      },
    );
  }
}

/** Escape one value for a CSV cell: wrap in quotes when it contains a
 *  comma, newline or quote, and double any embedded quote. */
function toCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(values: string[]): string {
  return values.map(toCsvCell).join(',');
}
