import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { LineService } from '@core/api/line.service';
import { MessageService } from '@core/api/message.service';
import { Line, BroadcastMessage, MessageSeverity, CreateMessageRequest } from '@shared/models';
import { MessageDialogComponent } from './message-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { createAdminListResource } from '@shared/admin/admin-list-resource';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { ADMIN_PAGE_SIZE_OPTIONS } from '@shared/utils/pagination.constants';
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
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);

  readonly tableState = inject(AdminTableState);
  protected readonly pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS;
  readonly lines = signal<Line[]>([]);

  severityLabel(severity: 'CRITICAL' | 'WARNING' | 'INFO',
                t: (key: string) => string): string {
    switch (severity) {
      case 'CRITICAL': return t('admin.messages.severityCritical');
      case 'WARNING': return t('admin.messages.severityWarning');
      case 'INFO': return t('admin.messages.severityInfo');
      default: return severity;
    }
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

  constructor() {
    this.lineService.getAll().subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.notify.error(this.transloco.translate('admin.messages.loadLinesFailed')),
    });
  }

  loadMessages(): void {
    this.list.reload();
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
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.transloco.translate('admin.messages.confirm.deleteTitle'),
        message: this.transloco.translate('admin.messages.confirm.deleteMessage', { title: message.title }),
        confirmText: this.transloco.translate('common.delete'),
        cancelText: this.transloco.translate('common.cancel'),
        confirmColor: 'warn',
      },
      ariaLabel: this.transloco.translate('admin.messages.confirm.deleteTitle'),
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.messageService.delete(message.id).subscribe({
          next: () => {
            this.loadMessages();
            this.notify.success(this.transloco.translate('admin.messages.deleteSuccess'));
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, this.transloco.translate('admin.messages.deleteFailed')));
          },
        });
      }
    });
  }
}
