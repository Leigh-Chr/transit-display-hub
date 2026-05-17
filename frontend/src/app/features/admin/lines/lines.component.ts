import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { LineService } from '@core/api/line.service';
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
    MatIconModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
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

  loadLines(): void {
    this.list.reload();
  }

  onSortChange(): void {
    this.tableState.page = 0;
    this.tableState.updateUrl();
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
