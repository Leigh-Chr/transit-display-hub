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
  template: `
    <ng-container *transloco="let t">
    <div class="messages-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.messages.title') }}</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          {{ t('admin.messages.newMessage') }}
        </button>
      </div>

      <div class="toolbar">
        <app-search-input
          [placeholder]="t('admin.messages.searchPlaceholder')"
          [initialValue]="tableState.search"
          (searchChange)="tableState.onSearchChange($event)"
        />

        <mat-form-field appearance="outline" class="severity-filter">
          <mat-label>{{ t('admin.messages.filterSeverity') }}</mat-label>
          <mat-select [value]="severity()" (selectionChange)="onSeverityChange($event.value)">
            <mat-option value="">{{ t('admin.messages.allSeverities') }}</mat-option>
            <mat-option value="CRITICAL">{{ t('admin.messages.severityCritical') }}</mat-option>
            <mat-option value="WARNING">{{ t('admin.messages.severityWarning') }}</mat-option>
            <mat-option value="INFO">{{ t('admin.messages.severityInfo') }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-checkbox
          [checked]="showActiveOnly()"
          (change)="onActiveChange($event.checked)"
          class="active-checkbox"
        >
          {{ t('admin.messages.activeOnly') }}
        </mat-checkbox>
      </div>

      @if (loading()) {
        <div class="messages-list">
          @for (i of [1, 2, 3]; track i) {
            <app-card-skeleton [showIcon]="true" />
          }
        </div>
      } @else if (loadError()) {
        <mat-card>
          <app-empty-state
            icon="error_outline"
            [title]="t('admin.messages.loadFailed')"
            [description]="t('admin.common.loadErrorDescription')"
            [actionLabel]="t('common.refresh')"
            actionIcon="refresh"
            (action)="loadMessages()"
          />
        </mat-card>
      } @else if (messages().length === 0 && !tableState.search && !severity() && !showActiveOnly()) {
        <mat-card>
          <app-empty-state
            icon="campaign"
            iconColor="primary"
            [title]="t('admin.messages.emptyTitle')"
            [description]="t('admin.messages.emptyDescription')"
            [actionLabel]="t('admin.messages.emptyAction')"
            actionIcon="add"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else if (messages().length === 0) {
        <mat-card>
          <app-empty-state
            icon="search_off"
            [title]="t('admin.messages.emptySearchTitle')"
            [description]="t('admin.messages.emptySearchDescription')"
          />
        </mat-card>
      } @else {
        <div class="messages-list" animate.enter="list-stagger">
          @for (message of messages(); track message.id) {
            <mat-card class="message-card">
              <div class="message-content">
                <div
                  class="severity-icon"
                  [class.critical]="message.severity === 'CRITICAL'"
                  [class.warning]="message.severity === 'WARNING'"
                  [class.info]="message.severity === 'INFO'"
                >
                  @switch (message.severity) {
                    @case ('CRITICAL') {
                      <mat-icon>error</mat-icon>
                    }
                    @case ('WARNING') {
                      <mat-icon>warning</mat-icon>
                    }
                    @default {
                      <mat-icon>info</mat-icon>
                    }
                  }
                </div>

                <div class="message-body">
                  <div class="message-header">
                    <h3 class="message-title">{{ message.title }}</h3>
                    <div class="badges">
                      <span
                        class="badge"
                        [class.badge-critical]="message.severity === 'CRITICAL'"
                        [class.badge-warning]="message.severity === 'WARNING'"
                        [class.badge-info]="message.severity === 'INFO'"
                      >
                        {{ message.severity }}
                      </span>
                      @if (isActive(message)) {
                        <span class="badge badge-active">{{ t('admin.messages.badgeActive') }}</span>
                      } @else {
                        <span class="badge badge-inactive">{{ t('admin.messages.badgeInactive') }}</span>
                      }
                    </div>
                  </div>
                  <p class="message-text">{{ message.content }}</p>
                  <div class="message-meta">
                    <span class="meta-label">{{ t('admin.messages.scopeLabel') }}</span>
                    @switch (message.scopeType) {
                      @case ('NETWORK') {
                        <span>{{ t('admin.messages.scopeNetwork') }}</span>
                      }
                      @case ('LINE') {
                        <span>{{ t('admin.messages.scopeLine', { name: message.scopeInfo?.name }) }}</span>
                      }
                      @case ('STOP') {
                        <span>{{ t('admin.messages.scopeStop', { name: message.scopeInfo?.name }) }}</span>
                      }
                    }
                    <span class="meta-separator hide-mobile">|</span>
                    <span class="hide-mobile">
                      {{ message.startTime | date : 'short' }} -
                      {{ message.endTime | date : 'short' }}
                    </span>
                  </div>
                </div>

                <div class="message-actions">
                  <button mat-icon-button color="primary" (click)="openEditDialog(message)" [matTooltip]="t('admin.messages.editTooltip')" [attr.aria-label]="t('admin.messages.editTooltip')">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteMessage(message)" [matTooltip]="t('admin.messages.deleteTooltip')" [attr.aria-label]="t('admin.messages.deleteTooltip')">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </mat-card>
          }
        </div>

        <mat-paginator
          [length]="totalElements()"
          [pageIndex]="tableState.page"
          [pageSize]="tableState.size"
          [pageSizeOptions]="pageSizeOptions"
          (page)="tableState.onPageChange($event)"
          showFirstLastButtons
        />
      }
    </div>
    </ng-container>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }

    .page-title {
      font-size: var(--m3-type-headline-large);
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
      align-items: center;
    }

    .severity-filter {
      width: 180px;
    }

    .active-checkbox {
      margin-left: auto;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: var(--app-gap-grid);
    }

    .message-card {
      padding: 20px;
      border-radius: var(--app-radius-md);
    }

    .message-content {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .severity-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--app-radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .severity-icon mat-icon {
      color: white;
    }

    .severity-icon.critical {
      background-color: var(--app-critical);
    }

    .severity-icon.warning {
      background-color: var(--app-warning);
    }

    .severity-icon.info {
      background-color: var(--app-info);
    }

    .message-body {
      flex: 1;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .message-title {
      margin: 0;
      font-size: var(--m3-type-title-large);
      font-weight: 600;
      color: var(--app-on-surface);
    }

    .message-text {
      color: var(--app-on-surface-variant);
      margin: 0 0 10px;
      line-height: 1.5;
    }

    .message-meta {
      font-size: var(--m3-type-body-small);
      color: var(--app-on-surface-muted);
    }

    .meta-label {
      font-weight: 600;
    }

    .meta-separator {
      margin: 0 10px;
      opacity: 0.5;
    }

    .message-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: var(--app-line-badge-radius);
      font-size: var(--m3-type-label-small);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-critical {
      background-color: var(--app-critical-container);
      color: var(--app-on-critical-container);
    }

    .badge-warning {
      background-color: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }

    .badge-info {
      background-color: var(--app-info-container);
      color: var(--app-on-info-container);
    }

    .badge-active {
      background-color: var(--app-success-container);
      color: var(--app-on-success-container);
    }

    .badge-inactive {
      background-color: var(--app-surface-container-high);
      color: var(--app-on-surface-variant);
    }

    .hide-mobile {
      @media (max-width: 600px) {
        display: none !important;
      }
    }

    mat-paginator {
      margin-top: 24px;
      border-radius: var(--app-radius-md);
    }

    /* Enter animations defined globally — see styles.scss section 13a */

    @media (max-width: 600px) {
      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .severity-filter {
        width: 100%;
      }

      .active-checkbox {
        margin-left: 0;
      }

      .message-content {
        flex-wrap: wrap;
      }

      .message-actions {
        width: 100%;
        justify-content: flex-end;
        margin-top: 12px;
      }
    }
  `,
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
