import { ChangeDetectionStrategy, Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { NotifyService } from '@core/services/notify.service';
import { LineService } from '@core/api/line.service';
import { MessageService } from '@core/api/message.service';
import { Line, BroadcastMessage, MessageSeverity, PageResponse, CreateMessageRequest } from '@shared/models';
import { MessageDialogComponent } from './message-dialog.component';
import {
  ConfirmDialogComponent,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { AdminTableState } from '@shared/admin/admin-table-state.service';
import { httpErrorMessage } from '@shared/utils/http.utils';

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
    CardSkeletonComponent,
    EmptyStateComponent,
    SearchInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminTableState],
  template: `
    <div class="messages-page">
      <div class="page-header">
        <h1 class="page-title">Broadcast Messages</h1>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          New Message
        </button>
      </div>

      <div class="toolbar">
        <app-search-input
          placeholder="Search messages..."
          [initialValue]="tableState.search"
          (searchChange)="tableState.onSearchChange($event)"
        />

        <mat-form-field appearance="outline" class="severity-filter">
          <mat-label>Severity</mat-label>
          <mat-select [value]="severity" (selectionChange)="onSeverityChange($event.value)">
            <mat-option value="">All severities</mat-option>
            <mat-option value="CRITICAL">Critical</mat-option>
            <mat-option value="WARNING">Warning</mat-option>
            <mat-option value="INFO">Info</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-checkbox
          [checked]="showActiveOnly"
          (change)="onActiveChange($event.checked)"
          class="active-checkbox"
        >
          Active only
        </mat-checkbox>
      </div>

      @if (loading()) {
        <div class="messages-list">
          @for (i of [1, 2, 3]; track i) {
            <app-card-skeleton [showIcon]="true" />
          }
        </div>
      } @else if (messages().length === 0 && !tableState.search && !severity && !showActiveOnly) {
        <mat-card>
          <app-empty-state
            icon="campaign"
            iconColor="primary"
            title="No messages found"
            description="Create broadcast messages to notify passengers across your transit network."
            actionLabel="Create Message"
            actionIcon="add"
            (action)="openCreateDialog()"
          />
        </mat-card>
      } @else if (messages().length === 0) {
        <mat-card>
          <app-empty-state
            icon="search_off"
            title="No results found"
            description="Try adjusting your search terms or filters."
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
                        <span class="badge badge-active">ACTIVE</span>
                      } @else {
                        <span class="badge badge-inactive">INACTIVE</span>
                      }
                    </div>
                  </div>
                  <p class="message-text">{{ message.content }}</p>
                  <div class="message-meta">
                    <span class="meta-label">Scope:</span>
                    @switch (message.scopeType) {
                      @case ('NETWORK') {
                        <span>Entire Network</span>
                      }
                      @case ('LINE') {
                        <span>Line: {{ message.scopeInfo?.name }}</span>
                      }
                      @case ('STOP') {
                        <span>Stop: {{ message.scopeInfo?.name }}</span>
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
                  <button mat-icon-button color="primary" (click)="openEditDialog(message)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteMessage(message)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </mat-card>
          }
        </div>

        <mat-paginator
          [length]="totalElements"
          [pageIndex]="tableState.page"
          [pageSize]="tableState.size"
          [pageSizeOptions]="[5, 10, 25, 50]"
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
      font-size: 17px;
      font-weight: 600;
      color: var(--app-on-surface);
    }

    .message-text {
      color: var(--app-on-surface-variant);
      margin: 0 0 10px;
      line-height: 1.5;
    }

    .message-meta {
      font-size: 13px;
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
      font-size: 11px;
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
export class MessagesComponent implements OnInit {
  private readonly messageService = inject(MessageService);
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly tableState = inject(AdminTableState);
  loading = signal(true);
  messages = signal<BroadcastMessage[]>([]);
  lines = signal<Line[]>([]);

  // Extra filter state (pushed into URL via the extras supplier)
  severity: MessageSeverity | '' = '';
  showActiveOnly = false;
  totalElements = 0;

  ngOnInit(): void {
    this.tableState.init({
      sortBy: 'startTime',
      sortDir: 'desc',
      extras: () => ({
        severity: this.severity || undefined,
        active: this.showActiveOnly ? 'true' : undefined,
      }),
    });

    this.lineService.getAll().subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.notify.error('Failed to load lines'),
    });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tableState.syncFromQueryParams(params);
      this.severity = (params['severity'] as MessageSeverity | undefined) ?? '';
      this.showActiveOnly = params['active'] === 'true';
      this.loadMessages();
    });
  }

  loadMessages(): void {
    this.loading.set(true);
    this.messageService
      .getAllPaginated({
        page: this.tableState.page,
        size: this.tableState.size,
        search: this.tableState.search || undefined,
        severity: this.severity || undefined,
        active: this.showActiveOnly || undefined,
        sortBy: 'startTime',
        sortDir: 'desc',
      })
      .subscribe({
        next: (response: PageResponse<BroadcastMessage>) => {
          if (response.content.length === 0 && this.tableState.page > 0 && response.totalElements > 0) {
            this.tableState.page = Math.max(0, response.totalPages - 1);
            this.tableState.updateUrl();
            this.loadMessages();
            return;
          }
          this.messages.set(response.content);
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.notify.error(httpErrorMessage(err, 'Failed to load messages'));
        },
      });
  }

  onSeverityChange(severity: MessageSeverity | ''): void {
    this.severity = severity;
    this.tableState.page = 0;
    this.tableState.updateUrl();
  }

  onActiveChange(active: boolean): void {
    this.showActiveOnly = active;
    this.tableState.page = 0;
    this.tableState.updateUrl();
  }

  isActive(message: BroadcastMessage): boolean {
    const now = new Date();
    return new Date(message.startTime) <= now && now <= new Date(message.endTime);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(MessageDialogComponent, {
      data: { lines: this.lines() },
      width: '500px',
      ariaLabel: 'Create new broadcast message',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.messageService.create(result as CreateMessageRequest).subscribe({
          next: () => {
            this.tableState.resetToFirstPage();
            this.loadMessages();
            this.notify.success('Message created');
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, 'Failed to create message'));
          },
        });
      }
    });
  }

  openEditDialog(message: BroadcastMessage): void {
    const dialogRef = this.dialog.open(MessageDialogComponent, {
      data: { message, lines: this.lines() },
      width: '500px',
      ariaLabel: `Edit message ${message.title}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.messageService.update(message.id, result as CreateMessageRequest).subscribe({
          next: () => {
            this.loadMessages();
            this.notify.success('Message updated');
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, 'Failed to update message'));
          },
        });
      }
    });
  }

  deleteMessage(message: BroadcastMessage): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Message',
        message: `Delete message "${message.title}"?`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
      ariaLabel: `Confirm deletion of message ${message.title}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.messageService.delete(message.id).subscribe({
          next: () => {
            this.loadMessages();
            this.notify.success('Message deleted');
          },
          error: (err: unknown) => {
            this.notify.error(httpErrorMessage(err, 'Failed to delete message'));
          },
        });
      }
    });
  }
}
