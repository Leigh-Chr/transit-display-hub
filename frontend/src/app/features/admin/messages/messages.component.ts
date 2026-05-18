import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { type Params } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { MessageService } from '@core/api/message.service';
import { BroadcastMessage, MessageSeverity, CreateMessageRequest } from '@shared/models';
import { MessageDialogComponent } from './message-dialog.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { createAdminListResource } from '@shared/admin/admin-list-resource';
import { confirmAndDelete } from '@shared/admin/confirm-and-delete';
import { useLinesResource } from '@shared/admin/use-lines-resource';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { ADMIN_PAGE_SIZE_OPTIONS } from '@shared/utils/pagination.constants';
import { severityLabel as severityLabelUtil } from '@shared/utils/severity-label';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatTooltipModule,
    CardSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss',
})
export class MessagesComponent {
  private readonly messageService = inject(MessageService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  readonly tableState = inject(AdminTableState);
  protected readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;
  readonly lines = useLinesResource('admin.messages');

  severityLabel(severity: 'CRITICAL' | 'WARNING' | 'INFO',
                t: (key: string) => string): string {
    return severityLabelUtil(severity, 'admin.messages', t);
  }

  // Extra filter state, persisted into the URL via the extras supplier
  // and mirrored back from it by syncFromUrl.
  readonly severity = signal<MessageSeverity | ''>('');
  readonly showActiveOnly = signal(false);

  private readonly list = createAdminListResource<BroadcastMessage>({
    tableState: this.tableState,
    defaults: { sortBy: 'startTime', sortDir: 'desc' },
    extras: {
      supply: () => ({
        severity: this.severity() || undefined,
        active: this.showActiveOnly() ? 'true' : undefined,
      }),
      syncFromUrl: (params: Params) => {
        this.severity.set((params['severity'] as MessageSeverity | undefined) ?? '');
        this.showActiveOnly.set(params['active'] === 'true');
      },
    },
    fetch: (request, raw) =>
      this.messageService.getAllPaginated({
        page: request.page,
        size: request.size,
        search: request.search,
        severity: (raw['severity'] as MessageSeverity | undefined) ?? undefined,
        active: raw['active'] === 'true' ? true : undefined,
        sortBy: request.sortBy,
        sortDir: request.sortDir,
      }),
  });

  readonly loading = this.list.loading;
  readonly loadError = this.list.loadError;
  readonly messages = this.list.items;
  readonly totalElements = this.list.totalElements;

  /** Multi-select for bulk delete — mirrors the pattern used on the
   *  lines page; see {@link LinesComponent} for the rationale. */
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectionCount = computed(() => this.selectedIds().size);
  readonly allCurrentSelected = computed(() => {
    const rows = this.messages();
    if (rows.length === 0) {return false;}
    const set = this.selectedIds();
    return rows.every((m) => set.has(m.id));
  });
  readonly someCurrentSelected = computed(() => {
    const set = this.selectedIds();
    return this.messages().some((m) => set.has(m.id)) && !this.allCurrentSelected();
  });

  loadMessages(): void {
    this.list.reload();
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
    for (const message of this.messages()) {
      if (checked) {
        next.add(message.id);
      } else {
        next.delete(message.id);
      }
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  bulkDeleteSelected(): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) {return;}

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.transloco.translate('admin.messages.confirm.bulkDeleteTitle'),
        message: this.transloco.translate('admin.messages.confirm.bulkDeleteMessage', { count: ids.length }),
        confirmText: this.transloco.translate('admin.messages.confirm.bulkDeleteConfirm'),
        cancelText: this.transloco.translate('common.cancel'),
        confirmColor: 'warn',
      },
      ariaLabel: this.transloco.translate('admin.messages.confirm.bulkDeleteTitle'),
    });

    ref.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (!confirmed) {return;}
      forkJoin(ids.map((id) => this.messageService.delete(id))).subscribe({
        next: () => {
          this.notify.success(this.transloco.translate('admin.messages.bulkDeleteSuccess', { count: ids.length }));
          this.clearSelection();
          this.loadMessages();
        },
        error: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.messages.bulkDeleteFailed')));
          this.clearSelection();
          this.loadMessages();
        },
      });
    });
  }

  onSeverityChange(severity: MessageSeverity | ''): void {
    this.severity.set(severity);
    this.tableState.resetToFirstPage();
  }

  onActiveChange(active: boolean): void {
    this.showActiveOnly.set(active);
    this.tableState.resetToFirstPage();
  }

  isActive(message: BroadcastMessage): boolean {
    const now = new Date();
    return new Date(message.startTime) <= now && now <= new Date(message.endTime);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(MessageDialogComponent, {
      data: {
        lines: this.lines(),
        submit: (request: CreateMessageRequest) => this.messageService.create(request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.messages.createFailed')));
        },
      },
      width: '500px',
      ariaLabel: this.transloco.translate('admin.messages.dialog.titleCreate'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.tableState.resetToFirstPage();
        this.loadMessages();
        this.notify.success(this.transloco.translate('admin.messages.createSuccess'));
      }
    });
  }

  openEditDialog(message: BroadcastMessage): void {
    const dialogRef = this.dialog.open(MessageDialogComponent, {
      data: {
        message,
        lines: this.lines(),
        submit: (request: CreateMessageRequest) => this.messageService.update(message.id, request),
        onError: (err: unknown) => {
          this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.messages.updateFailed')));
        },
      },
      width: '500px',
      ariaLabel: this.transloco.translate('admin.messages.dialog.titleEdit'),
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadMessages();
        this.notify.success(this.transloco.translate('admin.messages.updateSuccess'));
      }
    });
  }

  deleteMessage(message: BroadcastMessage): void {
    confirmAndDelete(
      { dialog: this.dialog, transloco: this.transloco, notify: this.notify },
      {
        titleKey: 'admin.messages.confirm.deleteTitle',
        messageKey: 'admin.messages.confirm.deleteMessage',
        messageArgs: { title: message.title },
        successKey: 'admin.messages.deleteSuccess',
        errorKey: 'admin.messages.deleteFailed',
        delete$: () => this.messageService.delete(message.id),
        onSuccess: () => this.loadMessages(),
      },
    );
  }
}
