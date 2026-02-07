import { ChangeDetectionStrategy, Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { LineService } from '@core/api/line.service';
import { MessageService } from '@core/api/message.service';
import { Line, BroadcastMessage, MessageSeverity, PageResponse, CreateMessageRequest } from '@shared/models';
import { MessageDialogComponent, MessageDialogData } from './message-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '@shared/components/confirm-dialog/confirm-dialog.component';
import { CardSkeletonComponent } from '@shared/components/skeleton/card-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';

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
          [initialValue]="search"
          (searchChange)="onSearchChange($event)"
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
      } @else if (messages().length === 0 && !search && !severity && !showActiveOnly) {
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
          [pageIndex]="page"
          [pageSize]="size"
          [pageSizeOptions]="[5, 10, 25, 50]"
          (page)="onPageChange($event)"
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

    /* Enter animations */
    @keyframes slideInUp {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .list-stagger { animation: slideInUp 250ms cubic-bezier(0.05, 0.7, 0.1, 1) forwards; }

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
export class MessagesComponent implements OnInit, OnDestroy {
  private readonly messageService = inject(MessageService);
  private readonly lineService = inject(LineService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  loading = signal(true);
  messages = signal<BroadcastMessage[]>([]);
  lines = signal<Line[]>([]);

  // Pagination and filter state
  page = 0;
  size = 10;
  search = '';
  severity: MessageSeverity | '' = '';
  showActiveOnly = false;
  totalElements = 0;

  ngOnInit(): void {
    this.lineService.getAll().subscribe({
      next: (lines) => this.lines.set(lines),
      error: () => this.snackBar.open('Failed to load lines', 'Close', { duration: 5000, panelClass: 'error-snackbar' }),
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.page = params['page'] ? +params['page'] : 0;
      this.size = params['size'] ? +params['size'] : 10;
      this.search = (params['search'] as string | undefined) ?? '';
      this.severity = (params['severity'] as MessageSeverity | undefined) ?? '';
      this.showActiveOnly = params['active'] === 'true';
      this.loadMessages();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMessages(): void {
    this.loading.set(true);
    this.messageService
      .getAllPaginated({
        page: this.page,
        size: this.size,
        search: this.search || undefined,
        severity: this.severity || undefined,
        active: this.showActiveOnly || undefined,
        sortBy: 'startTime',
        sortDir: 'desc',
      })
      .subscribe({
        next: (response: PageResponse<BroadcastMessage>) => {
          this.messages.set(response.content);
          this.totalElements = response.totalElements;
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const httpErr = err as { error?: { message?: string } };
          const message = httpErr.error?.message ?? 'Failed to load messages';
          this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
        },
      });
  }

  updateUrl(): void {
    const queryParams: Record<string, string | number | boolean> = {};
    if (this.page > 0) {queryParams['page'] = this.page;}
    if (this.size !== 10) {queryParams['size'] = this.size;}
    if (this.search) {queryParams['search'] = this.search;}
    if (this.severity) {queryParams['severity'] = this.severity;}
    if (this.showActiveOnly) {queryParams['active'] = 'true';}

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

  onSearchChange(search: string): void {
    this.search = search;
    this.page = 0;
    this.updateUrl();
  }

  onSeverityChange(severity: MessageSeverity | ''): void {
    this.severity = severity;
    this.page = 0;
    this.updateUrl();
  }

  onActiveChange(active: boolean): void {
    this.showActiveOnly = active;
    this.page = 0;
    this.updateUrl();
  }

  isActive(message: BroadcastMessage): boolean {
    const now = new Date();
    return new Date(message.startTime) <= now && now <= new Date(message.endTime);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(MessageDialogComponent, {
      data: { lines: this.lines() } as MessageDialogData,
      width: '500px',
      ariaLabel: 'Create new broadcast message',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.messageService.create(result as CreateMessageRequest).subscribe({
          next: () => {
            this.loadMessages();
            this.snackBar.open('Message created', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const message = httpErr.error?.message ?? 'Failed to create message';
            this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }

  openEditDialog(message: BroadcastMessage): void {
    const dialogRef = this.dialog.open(MessageDialogComponent, {
      data: { message, lines: this.lines() } as MessageDialogData,
      width: '500px',
      ariaLabel: `Edit message ${message.title}`,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.messageService.update(message.id, result as CreateMessageRequest).subscribe({
          next: () => {
            this.loadMessages();
            this.snackBar.open('Message updated', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const msg = httpErr.error?.message ?? 'Failed to update message';
            this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
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
      } as ConfirmDialogData,
      ariaLabel: `Confirm deletion of message ${message.title}`,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.messageService.delete(message.id).subscribe({
          next: () => {
            this.loadMessages();
            this.snackBar.open('Message deleted', 'Close', {
              duration: 3000,
              panelClass: 'success-snackbar',
            });
          },
          error: (err: unknown) => {
            const httpErr = err as { error?: { message?: string } };
            const msg = httpErr.error?.message ?? 'Failed to delete message';
            this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
          },
        });
      }
    });
  }
}
